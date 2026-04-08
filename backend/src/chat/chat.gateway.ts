import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RocketchatService } from '../rocketchat/rocketchat.service';
import { AuthService } from '../auth/auth.service';

interface ConnectedUser {
  userId: string;
  authToken: string;
  username: string;
  socket: Socket;
}

interface ChatMessage {
  CATEGORY: 'OPEN' | 'CLOSE' | 'EMISSION' | 'ROUTAGE';
  TARGET: string;
  SOURCE: string;
  TIMESTAMP: string;
  PAYLOAD: string;
}

@WebSocketGateway({
  cors: { origin: 'http://localhost:4200', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, ConnectedUser>();

  constructor(
    private rocketchatService: RocketchatService,
    private authService: AuthService,
  ) {}

  /**
   * Gère la connexion d'un nouveau client WebSocket.
   */
  async handleConnection(client: Socket) {
    const authToken = client.handshake.auth?.token as string;
    const userId = client.handshake.auth?.userId as string;

    if (!authToken || !userId) {
      client.disconnect();
      return;
    }

    const session = this.authService.validateToken(authToken);
    if (!session) {
      client.disconnect();
      return;
    }

    this.connectedUsers.set(client.id, {
      userId,
      authToken,
      username: session.username,
      socket: client,
    });

    client.join('common');
    client.join(session.username);

    const connectMessage: ChatMessage = {
      CATEGORY: 'OPEN',
      TARGET: 'COMMON',
      SOURCE: session.username,
      TIMESTAMP: new Date().toISOString(),
      PAYLOAD: `${session.username} s'est connecté`,
    };

    this.server.to('common').emit('message', connectMessage);
    this.broadcastUserList();
  }

  /**
   * Gère la déconnexion d'un client WebSocket.
   */
  async handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    const disconnectMessage: ChatMessage = {
      CATEGORY: 'CLOSE',
      TARGET: 'COMMON',
      SOURCE: user.username,
      TIMESTAMP: new Date().toISOString(),
      PAYLOAD: `${user.username} s'est déconnecté`,
    };

    this.server.to('common').emit('message', disconnectMessage);
    this.connectedUsers.delete(client.id);
    this.broadcastUserList();
  }

  /**
   * Reçoit un message et le route vers le bon destinataire via Rocket.Chat.
   */
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { target: string; message: string; roomId?: string },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    const chatMessage: ChatMessage = {
      CATEGORY: 'EMISSION',
      TARGET: data.target,
      SOURCE: user.username,
      TIMESTAMP: new Date().toISOString(),
      PAYLOAD: data.message,
    };

    if (data.roomId) {
      try {
        await this.rocketchatService.sendMessage(
          data.roomId,
          data.message,
          user.userId,
          user.authToken,
        );
      } catch (err) {
        client.emit('error', { message: 'Failed to send message to Rocket.Chat' });
      }
    }

    const routedMessage: ChatMessage = {
      ...chatMessage,
      CATEGORY: 'ROUTAGE',
    };

    if (data.target === 'COMMON') {
      this.server.to('common').emit('message', routedMessage);
    } else {
      this.server.to(data.target).emit('message', routedMessage);
      client.emit('message', routedMessage);
    }
  }

  /**
   * Gère l'adhésion à un channel spécifique.
   */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; roomName: string },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    client.join(data.roomName);

    try {
      await this.rocketchatService.joinChannel(data.roomId, user.userId, user.authToken);
    } catch {}

    client.emit('joinedRoom', { roomId: data.roomId, roomName: data.roomName });
  }

  /**
   * Gère le typing indicator.
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { target: string; isTyping: boolean },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    this.server.to(data.target).emit('userTyping', {
      username: user.username,
      isTyping: data.isTyping,
    });
  }

  /**
   * Envoie la liste des utilisateurs connectés à tous les clients.
   */
  private broadcastUserList() {
    const users = Array.from(this.connectedUsers.values()).map((u) => u.username);
    this.server.to('common').emit('userList', [...new Set(users)]);
  }
}
