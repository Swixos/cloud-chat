import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { RcChannel, RcMessage } from '../models/message.model';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  /**
   * Retrieves the list of public channels.
   * @returns List of channels
   */
  async getChannels(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/channels`, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the message history of a channel.
   * @param roomId - Channel ID
   * @param count - Maximum number of messages
   * @returns List of messages
   */
  async getMessages(roomId: string, count = 50): Promise<RcMessage[]> {
    return firstValueFrom(
      this.http.get<RcMessage[]>(`${API}/chat/messages`, {
        params: { roomId, count: count.toString() },
        headers: this.headers(),
      })
    );
  }

  /**
   * Creates a new public channel.
   * @param name - Channel name to create
   * @returns The created channel
   */
  async createChannel(name: string): Promise<RcChannel> {
    return firstValueFrom(
      this.http.post<RcChannel>(`${API}/chat/channels`, { name }, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the user's DM conversations.
   * @returns List of DMs
   */
  async getDirectMessages(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/dm`, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the history of a DM conversation.
   * @param roomId - DM room ID
   * @param count - Maximum number of messages
   * @returns List of messages
   */
  async getDmHistory(roomId: string, count = 50): Promise<RcMessage[]> {
    return firstValueFrom(
      this.http.get<RcMessage[]>(`${API}/chat/dm/history`, {
        params: { roomId, count: count.toString() },
        headers: this.headers(),
      })
    );
  }

  /**
   * Opens or creates a DM conversation with a user.
   * @param targetUsername - Recipient username
   * @returns The DM room ID
   */
  async createDm(targetUsername: string): Promise<{ rid: string }> {
    return firstValueFrom(
      this.http.post<{ rid: string }>(`${API}/chat/dm`, { targetUsername }, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the user's private groups.
   * @returns List of groups
   */
  async getGroups(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/groups`, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the message history of a private group.
   * @param roomId - Group ID
   * @param count - Maximum number of messages
   * @returns List of messages
   */
  async getGroupHistory(roomId: string, count = 50): Promise<RcMessage[]> {
    return firstValueFrom(
      this.http.get<RcMessage[]>(`${API}/chat/groups/history`, {
        params: { roomId, count: count.toString() },
        headers: this.headers(),
      })
    );
  }

  /**
   * Creates a private group with the specified members.
   * @param name - Group name
   * @param members - List of member usernames
   * @returns The created group
   */
  async createGroup(name: string, members: string[]): Promise<RcChannel> {
    return firstValueFrom(
      this.http.post<RcChannel>(`${API}/chat/groups`, { name, members }, { headers: this.headers() })
    );
  }

  /**
   * Retrieves the list of all registered users.
   * @returns List of users
   */
  async getUsers(): Promise<{ _id: string; username: string; name: string }[]> {
    return firstValueFrom(
      this.http.get<{ _id: string; username: string; name: string }[]>(`${API}/chat/users`, { headers: this.headers() })
    );
  }

  /**
   * Builds the authentication headers for the backend API.
   * @returns HTTP headers with session tokens
   */
  private headers(): HttpHeaders {
    const session = this.auth.session();
    return new HttpHeaders({
      'x-auth-token': session?.authToken || '',
      'x-user-id': session?.userId || '',
    });
  }
}
