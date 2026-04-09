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
  newConversation = signal<{ type: 'dm' | 'group' | 'channel' } | null>(null);

  constructor(private auth: AuthService) {}

  /**
   * Establishes the WebSocket connection with the NestJS server.
   * Configures listeners for messages, user list, and typing indicators.
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

    this.socket.on('newConversation', (data: { type: 'dm' | 'group' | 'channel' }) => {
      this.newConversation.set(data);
    });

    this.socket.on('error', (err: { message: string }) => {
      console.error('Socket error:', err.message);
    });
  }

  /**
   * Sends a message via WebSocket.
   * @param target - Message recipient (room name or username)
   * @param message - Message content
   * @param roomId - Optional Rocket.Chat room ID
   */
  sendMessage(target: string, message: string, roomId?: string): void {
    this.socket?.emit('sendMessage', { target, message, roomId });
  }

  /**
   * Joins a specific WebSocket room.
   * @param roomId - Room ID
   * @param roomName - Room name
   */
  joinRoom(roomId: string, roomName: string): void {
    this.socket?.emit('joinRoom', { roomId, roomName });
  }

  /**
   * Emits a typing indicator to the server.
   * @param target - Target room name
   * @param isTyping - `true` if the user is typing, `false` otherwise
   */
  sendTyping(target: string, isTyping: boolean): void {
    this.socket?.emit('typing', { target, isTyping });
  }

  /**
   * Clears the locally stored message list.
   */
  clearMessages(): void {
    this.messages.set([]);
  }

  /**
   * Disconnects the WebSocket and resets the local state.
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.messages.set([]);
    this.onlineUsers.set([]);
  }
}
