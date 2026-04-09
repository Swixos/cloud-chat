import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { SocketService } from '../../services/socket.service';
import { ChatMessage, RcChannel, RcMessage } from '../../models/message.model';

export interface UnifiedMessage {
  id: string;
  type: 'user' | 'system';
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
  imports: [FormsModule, DatePipe],
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
  activeTab = signal<'channels' | 'dms' | 'groups'>('channels');

  onlineUsers = computed(() => this.socketService.onlineUsers());
  typingUsers = computed(() =>
    this.socketService.typingUsers()
      .filter(u => u.isTyping && u.username !== this.auth.session()?.username)
  );
  currentUsername = computed(() => this.auth.session()?.username || '');

  /**
   * Retourne le nom d'affichage de la room active.
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
   * Retourne le prefixe de la room active.
   */
  activeRoomPrefix = computed(() => {
    const room = this.activeRoom();
    if (!room) return '';
    if (room.type === 'channel') return '#';
    if (room.type === 'group') return '';
    return '';
  });

  /**
   * Fusionne l'historique RC et les messages WS en une liste unique triee par timestamp.
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

    const fromWs: UnifiedMessage[] = this.socketService.messages().map((m, i) => ({
      id: `ws-${i}-${m.TIMESTAMP}`,
      type: (m.CATEGORY === 'OPEN' || m.CATEGORY === 'CLOSE') ? 'system' as const : 'user' as const,
      sender: m.SOURCE,
      text: m.PAYLOAD,
      timestamp: m.TIMESTAMP,
      own: m.SOURCE === username,
      category: m.CATEGORY,
    }));

    return [...fromRc, ...fromWs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });

  /**
   * Filtre les utilisateurs pour le DM (exclut soi-meme).
   */
  availableUsers = computed(() =>
    this.allUsers().filter(u => u.username !== this.currentUsername())
  );

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
      if (event.type === 'dm') this.loadDms();
      if (event.type === 'group') this.loadGroups();
      this.socketService.newConversation.set(null);
    });
  }

  /**
   * Initialise la connexion WebSocket et charge les donnees.
   */
  ngOnInit(): void {
    this.socketService.connect();
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  /**
   * Charge channels, DMs, groupes et utilisateurs.
   */
  async loadAll(): Promise<void> {
    await Promise.all([
      this.loadChannels(),
      this.loadDms(),
      this.loadGroups(),
      this.loadUsers(),
    ]);
  }

  async loadChannels(): Promise<void> {
    try {
      const channels = await this.chatService.getChannels();
      this.channels.set(channels);
      if (channels.length > 0 && !this.activeRoom()) {
        this.selectRoom({ _id: channels[0]._id, name: channels[0].name, type: 'channel' });
      }
    } catch {}
  }

  async loadDms(): Promise<void> {
    try {
      const dms = await this.chatService.getDirectMessages();
      this.dms.set(dms);
    } catch {}
  }

  async loadGroups(): Promise<void> {
    try {
      const groups = await this.chatService.getGroups();
      this.groups.set(groups);
    } catch {}
  }

  async loadUsers(): Promise<void> {
    try {
      const users = await this.chatService.getUsers();
      this.allUsers.set(users);
    } catch {}
  }

  /**
   * Selectionne une room et charge son historique.
   */
  async selectRoom(room: ActiveRoom): Promise<void> {
    this.activeRoom.set(room);
    this.socketService.clearMessages();
    this.socketService.joinRoom(room._id, room.name);

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
    }
  }

  /**
   * Retourne le nom d'affichage d'un DM (l'autre utilisateur).
   */
  dmDisplayName(dm: RcChannel): string {
    if (dm.usernames) {
      const other = dm.usernames.find((u: string) => u !== this.currentUsername());
      if (other) return other;
    }
    return dm.name;
  }

  /**
   * Ouvre un DM avec un utilisateur.
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
   * Cree un groupe prive.
   */
  async createGroup(): Promise<void> {
    if (!this.newGroupName.trim() || this.selectedGroupMembers().length === 0) return;
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
   * Toggle un membre dans la selection pour la creation de groupe.
   */
  toggleGroupMember(username: string): void {
    this.selectedGroupMembers.update(members =>
      members.includes(username)
        ? members.filter(m => m !== username)
        : [...members, username]
    );
  }

  /**
   * Envoie un message dans la room active.
   */
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.activeRoom()) return;

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

  onTyping(): void {
    const room = this.activeRoom();
    if (!room) return;
    this.socketService.sendTyping(room.name, true);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendTyping(room.name, false);
    }, 2000);
  }

  async createChannel(): Promise<void> {
    if (!this.newChannelName.trim()) return;
    try {
      await this.chatService.createChannel(this.newChannelName.trim());
      this.newChannelName = '';
      this.showCreateChannel.set(false);
      await this.loadChannels();
    } catch {}
  }

  logout(): void {
    this.socketService.disconnect();
    this.auth.logout();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
