import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { SocketService } from '../../services/socket.service';
import { ChatMessage, RcChannel, RcMessage } from '../../models/message.model';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  channels = signal<RcChannel[]>([]);
  currentChannel = signal<RcChannel | null>(null);
  rcMessages = signal<RcMessage[]>([]);
  newMessage = '';
  newChannelName = '';
  showCreateChannel = signal(false);
  showSidebar = signal(true);

  wsMessages = computed(() => this.socketService.messages());
  onlineUsers = computed(() => this.socketService.onlineUsers());
  typingUsers = computed(() =>
    this.socketService.typingUsers()
      .filter(u => u.isTyping && u.username !== this.auth.session()?.username)
  );

  currentUsername = computed(() => this.auth.session()?.username || '');
  private typingTimeout: any;
  private shouldScroll = false;

  constructor(
    private auth: AuthService,
    private chatService: ChatService,
    private socketService: SocketService,
  ) {}

  /**
   * Initialise la connexion WebSocket et charge les channels.
   */
  ngOnInit(): void {
    this.socketService.connect();
    this.loadChannels();
  }

  /**
   * Déconnecte le WebSocket à la destruction du composant.
   */
  ngOnDestroy(): void {
    this.socketService.disconnect();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
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
   * Sélectionne un channel et charge son historique.
   */
  async selectChannel(channel: RcChannel): Promise<void> {
    this.currentChannel.set(channel);
    this.socketService.clearMessages();

    this.socketService.joinRoom(channel._id, channel.name);

    try {
      const messages = await this.chatService.getMessages(channel._id);
      this.rcMessages.set(messages);
      this.shouldScroll = true;
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
    this.shouldScroll = true;
    this.socketService.sendTyping(channel.name, false);
  }

  /**
   * Gère l'indicateur de frappe.
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
   * Crée un nouveau channel.
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
   * Déconnecte l'utilisateur.
   */
  logout(): void {
    this.socketService.disconnect();
    this.auth.logout();
  }

  /**
   * Détecte la touche Entrée pour envoyer un message.
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
