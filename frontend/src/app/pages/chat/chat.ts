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

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  channels = signal<RcChannel[]>([]);
  currentChannel = signal<RcChannel | null>(null);
  private rcMessages = signal<RcMessage[]>([]);
  newMessage = '';
  newChannelName = '';
  showCreateChannel = signal(false);
  showSidebar = signal(true);

  onlineUsers = computed(() => this.socketService.onlineUsers());
  typingUsers = computed(() =>
    this.socketService.typingUsers()
      .filter(u => u.isTyping && u.username !== this.auth.session()?.username)
  );
  currentUsername = computed(() => this.auth.session()?.username || '');

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
  }

  /**
   * Initialise la connexion WebSocket et charge les channels.
   */
  ngOnInit(): void {
    this.socketService.connect();
    this.loadChannels();
  }

  /**
   * Deconnecte le WebSocket a la destruction du composant.
   */
  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  /**
   * Charge la liste des channels depuis Rocket.Chat.
   */
  async loadChannels(): Promise<void> {
    try {
      const channels = await this.chatService.getChannels();
      this.channels.set(channels);
      if (channels.length > 0 && !this.currentChannel()) {
        this.selectChannel(channels[0]);
      }
    } catch {}
  }

  /**
   * Selectionne un channel et charge son historique.
   */
  async selectChannel(channel: RcChannel): Promise<void> {
    this.currentChannel.set(channel);
    this.socketService.clearMessages();

    this.socketService.joinRoom(channel._id, channel.name);

    try {
      const messages = await this.chatService.getMessages(channel._id);
      this.rcMessages.set(messages);

    } catch {
      this.rcMessages.set([]);
    }
  }

  /**
   * Envoie un message dans le channel courant.
   */
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.currentChannel()) return;

    const channel = this.currentChannel()!;
    const text = this.newMessage.trim();

    this.rcMessages.update(msgs => [...msgs, {
      _id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      msg: text,
      u: { _id: this.auth.session()!.userId, username: this.currentUsername() },
      ts: new Date().toISOString(),
      rid: channel._id,
    }]);

    this.socketService.sendMessage(channel.name, text, channel._id);
    this.newMessage = '';
    this.socketService.sendTyping(channel.name, false);
  }

  /**
   * Gere l'indicateur de frappe.
   */
  onTyping(): void {
    const channel = this.currentChannel();
    if (!channel) return;

    this.socketService.sendTyping(channel.name, true);

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendTyping(channel.name, false);
    }, 2000);
  }

  /**
   * Cree un nouveau channel.
   */
  async createChannel(): Promise<void> {
    if (!this.newChannelName.trim()) return;
    try {
      await this.chatService.createChannel(this.newChannelName.trim());
      this.newChannelName = '';
      this.showCreateChannel.set(false);
      await this.loadChannels();
    } catch {}
  }

  /**
   * Deconnecte l'utilisateur.
   */
  logout(): void {
    this.socketService.disconnect();
    this.auth.logout();
  }

  /**
   * Detecte la touche Entree pour envoyer un message.
   */
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
