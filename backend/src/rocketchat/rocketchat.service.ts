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

  /**
   * Checks connectivity with Rocket.Chat on module startup.
   */
  async onModuleInit() {
    try {
      const res = await this.api.get('/info');
      console.log(`Rocket.Chat connected: v${res.data.info?.version || 'unknown'}`);
    } catch {
      console.warn('Rocket.Chat not reachable at', this.baseUrl);
    }
  }

  /**
   * Authenticates a user against the Rocket.Chat API.
   * @param username - Username
   * @param password - Password
   * @returns The authenticated user credentials
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
   * Registers a new user in Rocket.Chat then authenticates them.
   * @param username - Desired username
   * @param password - Chosen password
   * @param email - Email address
   * @param name - Full name
   * @returns The created user credentials
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
   * Logs out a user from the Rocket.Chat API.
   * @param userId - User ID
   * @param authToken - Authentication token
   */
  async logout(userId: string, authToken: string): Promise<void> {
    await this.api.post('/logout', {}, {
      headers: this.authHeaders(userId, authToken),
    });
  }

  /**
   * Retrieves the list of public channels and auto-joins the user to each one.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns List of public channels
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
   * Retrieves the message history of a channel.
   * @param roomId - Channel ID
   * @param userId - User ID
   * @param authToken - Authentication token
   * @param count - Maximum number of messages to retrieve
   * @returns List of messages sorted chronologically
   */
  async getMessages(roomId: string, userId: string, authToken: string, count = 50): Promise<RcMessage[]> {
    const res = await this.api.get('/channels.history', {
      params: { roomId, count },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.messages.filter((m: any) => !m.t).reverse();
  }

  /**
   * Sends a message in a Rocket.Chat channel.
   * @param roomId - Target channel ID
   * @param text - Message content
   * @param userId - Sender ID
   * @param authToken - Authentication token
   * @returns The sent message
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
   * Creates a public channel in Rocket.Chat.
   * @param name - Channel name to create
   * @param userId - Creator user ID
   * @param authToken - Authentication token
   * @returns The created channel
   */
  async createChannel(name: string, userId: string, authToken: string): Promise<RcChannel> {
    const res = await this.api.post('/channels.create', { name }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.channel;
  }

  /**
   * Joins an existing channel in Rocket.Chat.
   * @param roomId - Channel ID to join
   * @param userId - User ID
   * @param authToken - Authentication token
   */
  async joinChannel(roomId: string, userId: string, authToken: string): Promise<void> {
    await this.api.post('/channels.join', { roomId }, {
      headers: this.authHeaders(userId, authToken),
    });
  }

  /**
   * Opens or creates a DM conversation with a target user.
   * @param targetUsername - Recipient username
   * @param userId - Initiating user ID
   * @param authToken - Authentication token
   * @returns The created DM room ID
   */
  async createDirectMessage(targetUsername: string, userId: string, authToken: string): Promise<{ rid: string }> {
    const res = await this.api.post('/dm.create', {
      username: targetUsername,
    }, {
      headers: this.authHeaders(userId, authToken),
    });
    return { rid: res.data.room._id || res.data.room.rid };
  }

  /**
   * Retrieves the user's DM conversation list.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns List of DM conversations
   */
  async getDirectMessages(userId: string, authToken: string): Promise<RcChannel[]> {
    const res = await this.api.get('/dm.list', {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.ims;
  }

  /**
   * Retrieves the message history of a DM conversation.
   * @param roomId - DM room ID
   * @param userId - User ID
   * @param authToken - Authentication token
   * @param count - Maximum number of messages to retrieve
   * @returns List of messages sorted chronologically
   */
  async getDmHistory(roomId: string, userId: string, authToken: string, count = 50): Promise<RcMessage[]> {
    const res = await this.api.get('/dm.history', {
      params: { roomId, count },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.messages.filter((m: any) => !m.t).reverse();
  }

  /**
   * Sends a message in a DM or group via the Rocket.Chat API.
   * @param roomId - Target room ID
   * @param text - Message content
   * @param userId - Sender ID
   * @param authToken - Authentication token
   * @returns The sent message
   */
  async sendDmMessage(roomId: string, text: string, userId: string, authToken: string): Promise<RcMessage> {
    const res = await this.api.post('/chat.sendMessage', {
      message: { rid: roomId, msg: text },
    }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.message;
  }

  /**
   * Creates a private group in Rocket.Chat.
   * @param name - Group name (will be sanitized: lowercase, spaces replaced with hyphens)
   * @param members - List of usernames to add to the group
   * @param userId - Creator user ID
   * @param authToken - Authentication token
   * @returns The created group
   */
  async createGroup(name: string, members: string[], userId: string, authToken: string): Promise<RcChannel> {
    const sanitizedName = name.trim().replace(/\s+/g, '-').toLowerCase();
    const res = await this.api.post('/groups.create', {
      name: sanitizedName,
      members,
    }, {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.group;
  }

  /**
   * Retrieves the user's private groups.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns List of private groups
   */
  async getGroups(userId: string, authToken: string): Promise<RcChannel[]> {
    const res = await this.api.get('/groups.list', {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.groups;
  }

  /**
   * Retrieves the message history of a private group.
   * @param roomId - Group ID
   * @param userId - User ID
   * @param authToken - Authentication token
   * @param count - Maximum number of messages to retrieve
   * @returns List of messages sorted chronologically
   */
  async getGroupHistory(roomId: string, userId: string, authToken: string, count = 50): Promise<RcMessage[]> {
    const res = await this.api.get('/groups.history', {
      params: { roomId, count },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.messages.filter((m: any) => !m.t).reverse();
  }

  /**
   * Retrieves the list of all registered users.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns List of users with their id, username, and name
   */
  async getUsers(userId: string, authToken: string): Promise<{ _id: string; username: string; name: string }[]> {
    const res = await this.api.get('/users.list', {
      params: { count: 200 },
      headers: this.authHeaders(userId, authToken),
    });
    return res.data.users;
  }

  /**
   * Retrieves the current user's profile information.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns User profile data
   */
  async me(userId: string, authToken: string): Promise<any> {
    const res = await this.api.get('/me', {
      headers: this.authHeaders(userId, authToken),
    });
    return res.data;
  }

  /**
   * Returns the Rocket.Chat WebSocket URL.
   * @returns URL in `ws(s)://host/websocket` format
   */
  getWebsocketUrl(): string {
    return this.baseUrl.replace(/^http/, 'ws') + '/websocket';
  }

  /**
   * Returns the Rocket.Chat base API URL.
   * @returns Rocket.Chat HTTP URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Builds the Rocket.Chat authentication headers.
   * @param userId - User ID
   * @param authToken - Authentication token
   * @returns HTTP headers for the Rocket.Chat API
   */
  private authHeaders(userId: string, authToken: string) {
    return { 'X-User-Id': userId, 'X-Auth-Token': authToken };
  }
}
