import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { SocketService } from '../../services/socket.service';
import { ChatMessage, RcChannel, RcMessage } from '../../models/message.model';
import { LinkifyPipe } from '../../pipes/linkify.pipe';
import { EmojiPickerComponent } from '../../components/emoji-picker/emoji-picker';

export interface UnifiedMessage {
  id: string;
  type: 'user' | 'system' | 'date-separator';
  sender: string;
  text: string;
  timestamp: string;
  own: boolean;
  category?: string;
}

export type RoomType = 'channel' | 'dm' | 'group';

export interface ActiveRoom {
  _id: string;
  name: string;
  type: RoomType;
  usernames?: string[];
}

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe, LinkifyPipe, EmojiPickerComponent],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  channels = signal<RcChannel[]>([]);
  dms = signal<RcChannel[]>([]);
  groups = signal<RcChannel[]>([]);
  allUsers = signal<{ _id: string; username: string; name: string }[]>([]);

  activeRoom = signal<ActiveRoom | null>(null);
  private rcMessages = signal<RcMessage[]>([]);
  newMessage = '';
  newChannelName = '';
  newGroupName = '';
  selectedGroupMembers = signal<string[]>([]);

  showCreateChannel = signal(false);
  showCreateGroup = signal(false);
  showNewDm = signal(false);
  showSidebar = signal(true);
  loadingRoom = signal(false);
  activeTab = signal<'channels' | 'dms' | 'groups'>('channels');
  maxRoomNameLength = 50;

  onlineUsers = computed(() => this.socketService.onlineUsers());
  typingUsers = computed(() => {
    const room = this.activeRoom();
    return this.socketService.typingUsers()
      .filter(u => u.isTyping && u.username !== this.auth.session()?.username && u.target === room?.name);
  });
  currentUsername = computed(() => this.auth.session()?.username || '');

  /**
   * Display name of the active room (other user for DMs, name otherwise).
   */
  activeRoomDisplay = computed(() => {
    const room = this.activeRoom();
    if (!room) return '';
    if (room.type === 'dm' && room.usernames) {
      const other = room.usernames.find(u => u !== this.currentUsername());
      return other || room.name;
    }
    return room.name;
  });

  /**
   * Visual prefix of the active room (`#` for channels).
   */
  activeRoomPrefix = computed(() => {
    const room = this.activeRoom();
    if (!room) return '';
    if (room.type === 'channel') return '#';
    if (room.type === 'group') return '';
    return '';
  });

  /**
   * Unified message list (RC history + WebSocket) sorted chronologically,
   * with date separators inserted between days.
   */
  allMessages = computed<UnifiedMessage[]>(() => {
    const username = this.currentUsername();

    const fromRc: UnifiedMessage[] = this.rcMessages().map(m => ({
      id: m._id,
      type: 'user' as const,
      sender: m.u.username,
      text: m.msg,
      timestamp: m.ts,
      own: m.u.username === username,
    }));

    const room = this.activeRoom();
    const fromWs: UnifiedMessage[] = this.socketService.messages()
      .filter(m => {
        if (m.CATEGORY === 'OPEN' || m.CATEGORY === 'CLOSE') return true;
        return m.TARGET === room?.name;
      })
      .map((m, i) => ({
        id: `ws-${i}-${m.TIMESTAMP}`,
        type: (m.CATEGORY === 'OPEN' || m.CATEGORY === 'CLOSE') ? 'system' as const : 'user' as const,
        sender: m.SOURCE,
        text: m.PAYLOAD,
        timestamp: m.TIMESTAMP,
        own: m.SOURCE === username,
        category: m.CATEGORY,
      }));

    const sorted = [...fromRc, ...fromWs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const result: UnifiedMessage[] = [];
    let lastDateKey = '';

    for (const msg of sorted) {
      const dateKey = new Date(msg.timestamp).toLocaleDateString('fr-FR');
      if (dateKey !== lastDateKey) {
        result.push({
          id: `sep-${dateKey}`,
          type: 'date-separator',
          sender: '',
          text: this.formatDateLabel(new Date(msg.timestamp)),
          timestamp: msg.timestamp,
          own: false,
        });
        lastDateKey = dateKey;
      }
      result.push(msg);
    }

    return result;
  });

  /**
   * List of available users for DMs (excludes the current user).
   */
  availableUsers = computed(() =>
    this.allUsers().filter(u => u.username !== this.currentUsername())
  );

  /**
   * Checks if the entered channel name already exists (case-insensitive).
   * @returns Error message or `null` if valid
   */
  channelNameError(): string | null {
    const name = this.newChannelName.trim().toLowerCase();
    if (!name) return null;
    if (this.channels().some(c => c.name.toLowerCase() === name)) {
      return 'Un channel avec ce nom existe déjà';
    }
    return null;
  }

  /**
   * Checks if the entered group name already exists (case-insensitive).
   * @returns Error message or `null` if valid
   */
  groupNameError(): string | null {
    const name = this.newGroupName.trim().toLowerCase();
    if (!name) return null;
    if (this.groups().some(g => g.name.toLowerCase() === name)) {
      return 'Un groupe avec ce nom existe déjà';
    }
    return null;
  }

  private typingTimeout: any;

  constructor(
    public auth: AuthService,
    private chatService: ChatService,
    private socketService: SocketService,
  ) {
    effect(() => {
      this.allMessages();
      setTimeout(() => this.scrollToBottom(), 0);
    });

    effect(() => {
      const event = this.socketService.newConversation();
      if (!event) return;
      if (event.type === 'channel') this.loadChannels();
      if (event.type === 'dm') this.loadDms();
      if (event.type === 'group') this.loadGroups();
      this.socketService.newConversation.set(null);
    });
  }

  /**
   * Initializes the WebSocket connection and loads all data.
   */
  ngOnInit(): void {
    this.socketService.connect();
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  /**
   * Loads channels, DMs, groups, and users in parallel.
   */
  async loadAll(): Promise<void> {
    await Promise.all([
      this.loadChannels(),
      this.loadDms(),
      this.loadGroups(),
      this.loadUsers(),
    ]);
  }

  /**
   * Loads the channel list and selects the first one if no room is active.
   */
  async loadChannels(): Promise<void> {
    try {
      const channels = await this.chatService.getChannels();
      this.channels.set(channels);
      if (channels.length > 0 && !this.activeRoom()) {
        this.selectRoom({ _id: channels[0]._id, name: channels[0].name, type: 'channel' });
      }
    } catch {}
  }

  /**
   * Loads the DM conversation list.
   */
  async loadDms(): Promise<void> {
    try {
      const dms = await this.chatService.getDirectMessages();
      this.dms.set(dms);
    } catch {}
  }

  /**
   * Loads the private group list.
   */
  async loadGroups(): Promise<void> {
    try {
      const groups = await this.chatService.getGroups();
      this.groups.set(groups);
    } catch {}
  }

  /**
   * Loads the full user list.
   */
  async loadUsers(): Promise<void> {
    try {
      const users = await this.chatService.getUsers();
      this.allUsers.set(users);
    } catch {}
  }

  /**
   * Selects a room, joins the WebSocket channel, and loads the message history.
   * @param room - Room to select
   */
  async selectRoom(room: ActiveRoom): Promise<void> {
    this.activeRoom.set(room);
    this.socketService.clearMessages();
    this.socketService.joinRoom(room._id, room.name);
    this.loadingRoom.set(true);
    this.rcMessages.set([]);

    try {
      let messages: RcMessage[];
      if (room.type === 'dm') {
        messages = await this.chatService.getDmHistory(room._id);
      } else if (room.type === 'group') {
        messages = await this.chatService.getGroupHistory(room._id);
      } else {
        messages = await this.chatService.getMessages(room._id);
      }
      this.rcMessages.set(messages);
    } catch {
      this.rcMessages.set([]);
    } finally {
      this.loadingRoom.set(false);
    }
  }

  /**
   * Returns the display name of a DM (the other user in the chat).
   * @param dm - DM channel
   * @returns The other user's name or the room name
   */
  dmDisplayName(dm: RcChannel): string {
    if (dm.usernames) {
      const other = dm.usernames.find((u: string) => u !== this.currentUsername());
      if (other) return other;
    }
    return dm.name;
  }

  /**
   * Opens or creates a DM conversation with a user.
   * @param username - Recipient username
   */
  async openDm(username: string): Promise<void> {
    try {
      const result = await this.chatService.createDm(username);
      this.showNewDm.set(false);
      await this.loadDms();
      this.activeTab.set('dms');
      const dm = this.dms().find(d => d._id === result.rid);
      if (dm) {
        this.selectRoom({ _id: dm._id, name: dm.name, type: 'dm', usernames: dm.usernames });
      } else {
        this.selectRoom({ _id: result.rid, name: username, type: 'dm', usernames: [this.currentUsername(), username] });
      }
    } catch {}
  }

  /**
   * Creates a private group with the selected members.
   */
  async createGroup(): Promise<void> {
    if (!this.newGroupName.trim() || this.selectedGroupMembers().length === 0 || this.groupNameError()) return;
    try {
      const group = await this.chatService.createGroup(this.newGroupName.trim(), this.selectedGroupMembers());
      this.newGroupName = '';
      this.selectedGroupMembers.set([]);
      this.showCreateGroup.set(false);
      await this.loadGroups();
      this.activeTab.set('groups');
      this.selectRoom({ _id: group._id, name: group.name, type: 'group' });
    } catch {}
  }

  /**
   * Adds or removes a member from the group creation selection.
   * @param username - Username to add/remove
   */
  toggleGroupMember(username: string): void {
    this.selectedGroupMembers.update(members =>
      members.includes(username)
        ? members.filter(m => m !== username)
        : [...members, username]
    );
  }

  /**
   * Sends the current message in the active room via WebSocket and Rocket.Chat.
   */
  maxMessageLength = 2000;

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeRoom() || this.newMessage.length > this.maxMessageLength) return;

    const room = this.activeRoom()!;
    const text = this.newMessage.trim();

    this.rcMessages.update(msgs => [...msgs, {
      _id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      msg: text,
      u: { _id: this.auth.session()!.userId, username: this.currentUsername() },
      ts: new Date().toISOString(),
      rid: room._id,
    }]);

    this.socketService.sendMessage(room.name, text, room._id);
    this.newMessage = '';
    this.socketService.sendTyping(room.name, false);
  }

  /**
   * Emits a typing indicator to the server with an automatic stop delay.
   */
  onTyping(): void {
    const room = this.activeRoom();
    if (!room) return;
    this.socketService.sendTyping(room.name, true);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendTyping(room.name, false);
    }, 2000);
  }

  /**
   * Creates a new public channel.
   */
  async createChannel(): Promise<void> {
    if (!this.newChannelName.trim() || this.channelNameError()) return;
    try {
      await this.chatService.createChannel(this.newChannelName.trim());
      this.newChannelName = '';
      this.showCreateChannel.set(false);
      await this.loadChannels();
    } catch {}
  }

  /**
   * Disconnects the WebSocket and redirects to the login page.
   */
  logout(): void {
    this.socketService.disconnect();
    this.auth.logout();
  }

  /**
   * Inserts an emoji into the message being composed.
   * @param emoji - Emoji character to insert
   */
  insertEmoji(emoji: string): void {
    this.newMessage += emoji;
  }

  /**
   * Handles sending the message via Enter (without Shift).
   * @param event - Keyboard event
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Formats a relative date label (Today, Yesterday, weekday, full date).
   * @param date - Date to format
   * @returns Date label
   */
  private formatDateLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = today.getTime() - target.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return date.toLocaleDateString('fr-FR', { weekday: 'long' });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Scrolls the message area to the bottom.
   */
  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
