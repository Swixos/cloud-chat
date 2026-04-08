import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface RcUser {
  userId: string;
  authToken: string;
  username: string;
}

export interface RcChannel {
  _id: string;
  name: string;
  t: string;
}

export interface RcMessage {
  _id: string;
  msg: string;
  u: { _id: string; username: string };
  ts: string;
  rid: string;
}

@Injectable()
export class RocketchatService implements OnModuleInit {
  private api: AxiosInstance;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ROCKETCHAT_URL', 'http://localhost:3100');
    this.api = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async onModuleInit() {
    try {
      const res = await this.api.get('/info');
      console.log(`Rocket.Chat connected: v${res.data.info?.version || 'unknown'}`);
    } catch {
      console.warn('Rocket.Chat not reachable at', this.baseUrl);
    }
  }

  /**
   * Authentifie un utilisateur via Rocket.Chat et retourne ses credentials.
   */
  async login(username: string, password: string): Promise<RcUser> {
    const res = await this.api.post('/login', { user: username, password });
    return {
      userId: res.data.data.userId,
      authToken: res.data.data.authToken,
      username: res.data.data.me.username,
    };
  }

  /**
   * Enregistre un nouvel utilisateur dans Rocket.Chat.
   */
  async register(username: string, password: string, email: string, name: string): Promise<RcUser> {
    await this.api.post('/users.register', {
      username,
      pass: password,
      email,
      name,
    });
    return this.login(username, password);
  }

  /**
   * Déconnecte un utilisateur de Rocket.Chat.
   */
  async logout(userId: string, authToken: string): Promise<void> {
    await this.api.post('/logout', {}, {
      headers: this.authHeaders(userId, authToken),
    });
  }

  /**
   * Récupère tous les channels publics et auto-join l'utilisateur.
   */
  async getChannels(userId: string, authToken: string): Promise<RcChannel[]> {
    const res = await this.api.get('/channels.list', {
      params: { count: 100 },
      headers: this.authHeaders(userId, authToken),
    });
    const channels: RcChannel[] = res.data.channels;

    for (const channel of channels) {
      try {
        await this.joinChannel(channel._id, userId, authToken);
      } catch {}
    }

    return channels;
  }

  /**
   * Récupère l'historique des messages d'un channel.
   */
  async getMessages(roomId: string, userId: string, authToken: string, count = 50): Promise<RcMessage[]> {
    const res = await this.api.get('/channels.history', {
      params: { roomId, count },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.messages.reverse();
  }

  /**
   * Envoie un message dans un channel Rocket.Chat.
   */
  async sendMessage(roomId: string, text: string, userId: string, authToken: string): Promise<RcMessage> {
    const res = await this.api.post('/chat.sendMessage', {
      message: { rid: roomId, msg: text },
    }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.message;
  }

  /**
   * Crée un channel dans Rocket.Chat.
   */
  async createChannel(name: string, userId: string, authToken: string): Promise<RcChannel> {
    const res = await this.api.post('/channels.create', { name }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.channel;
  }

  /**
   * Rejoint un channel existant dans Rocket.Chat.
   */
  async joinChannel(roomId: string, userId: string, authToken: string): Promise<void> {
    await this.api.post('/channels.join', { roomId }, {
      headers: this.authHeaders(userId, authToken),
    });
  }

  /**
   * Envoie un message privé (DM) à un utilisateur.
   */
  async sendDirectMessage(targetUsername: string, text: string, userId: string, authToken: string): Promise<RcMessage> {
    const res = await this.api.post('/chat.postMessage', {
      channel: `@${targetUsername}`,
      text,
    }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.message;
  }

  /**
   * Récupère les DMs (direct messages) de l'utilisateur.
   */
  async getDirectMessages(userId: string, authToken: string): Promise<RcChannel[]> {
    const res = await this.api.get('/dm.list', {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.ims;
  }

  /**
   * Récupère l'historique d'un DM.
   */
  async getDmHistory(roomId: string, userId: string, authToken: string, count = 50): Promise<RcMessage[]> {
    const res = await this.api.get('/dm.history', {
      params: { roomId, count },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.messages.reverse();
  }

  /**
   * Récupère les informations de l'utilisateur courant.
   */
  async me(userId: string, authToken: string): Promise<any> {
    const res = await this.api.get('/me', {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data;
  }

  /**
   * Retourne le URL de base de Rocket.Chat pour le websocket client.
   */
  getWebsocketUrl(): string {
    return this.baseUrl.replace(/^http/, 'ws') + '/websocket';
  }

  /**
   * Retourne le URL de base de Rocket.Chat.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  private authHeaders(userId: string, authToken: string) {
    return { 'X-User-Id': userId, 'X-Auth-Token': authToken };
  }
}
