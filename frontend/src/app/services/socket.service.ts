import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/message.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  messages = signal<ChatMessage[]>([]);
  onlineUsers = signal<string[]>([]);
  typingUsers = signal<{ username: string; isTyping: boolean; target: string }[]>([]);
  newConversation = signal<{ type: 'dm' | 'group' } | null>(null);

  constructor(private auth: AuthService) {}

  /**
   * Établit la connexion WebSocket avec le serveur NestJS.
   */
  connect(): void {
    const session = this.auth.session();
    if (!session) return;

    this.socket = io(environment.wsUrl, {
      auth: { token: session.authToken, userId: session.userId },
    });

    this.socket.on('message', (msg: ChatMessage) => {
      this.messages.update((msgs) => [...msgs, msg]);
    });

    this.socket.on('userList', (users: string[]) => {
      this.onlineUsers.set(users);
    });

    this.socket.on('userTyping', (data: { username: string; isTyping: boolean; target: string }) => {
      this.typingUsers.update((users) => {
        const filtered = users.filter((u) => u.username !== data.username || u.target !== data.target);
        if (data.isTyping) filtered.push(data);
        return filtered;
      });
    });

    this.socket.on('newConversation', (data: { type: 'dm' | 'group' }) => {
      this.newConversation.set(data);
    });

    this.socket.on('error', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });
  }

  /**
   * Envoie un message via WebSocket.
   */
  sendMessage(target: string, message: string, roomId?: string): void {
    this.socket?.emit('sendMessage', { target, message, roomId });
  }

  /**
   * Rejoint un room spécifique.
   */
  joinRoom(roomId: string, roomName: string): void {
    this.socket?.emit('joinRoom', { roomId, roomName });
  }

  /**
   * Émet un indicateur de frappe.
   */
  sendTyping(target: string, isTyping: boolean): void {
    this.socket?.emit('typing', { target, isTyping });
  }

  /**
   * Vide les messages stockés.
   */
  clearMessages(): void {
    this.messages.set([]);
  }

  /**
   * Déconnecte le WebSocket.
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.messages.set([]);
    this.onlineUsers.set([]);
  }
}
