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
   * Recupere la liste des channels publics.
   */
  async getChannels(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/channels`, { headers: this.headers() })
    );
  }

  /**
   * Recupere l'historique des messages d'un channel.
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
   * Cree un nouveau channel public.
   */
  async createChannel(name: string): Promise<RcChannel> {
    return firstValueFrom(
      this.http.post<RcChannel>(`${API}/chat/channels`, { name }, { headers: this.headers() })
    );
  }

  /**
   * Recupere les DMs de l'utilisateur.
   */
  async getDirectMessages(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/dm`, { headers: this.headers() })
    );
  }

  /**
   * Recupere l'historique d'un DM.
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
   * Ouvre ou cree un DM avec un utilisateur.
   */
  async createDm(targetUsername: string): Promise<{ rid: string }> {
    return firstValueFrom(
      this.http.post<{ rid: string }>(`${API}/chat/dm`, { targetUsername }, { headers: this.headers() })
    );
  }

  /**
   * Recupere les groupes prives.
   */
  async getGroups(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/groups`, { headers: this.headers() })
    );
  }

  /**
   * Recupere l'historique d'un groupe prive.
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
   * Cree un groupe prive.
   */
  async createGroup(name: string, members: string[]): Promise<RcChannel> {
    return firstValueFrom(
      this.http.post<RcChannel>(`${API}/chat/groups`, { name, members }, { headers: this.headers() })
    );
  }

  /**
   * Recupere la liste de tous les utilisateurs.
   */
  async getUsers(): Promise<{ _id: string; username: string; name: string }[]> {
    return firstValueFrom(
      this.http.get<{ _id: string; username: string; name: string }[]>(`${API}/chat/users`, { headers: this.headers() })
    );
  }

  private headers(): HttpHeaders {
    const session = this.auth.session();
    return new HttpHeaders({
      'x-auth-token': session?.authToken || '',
      'x-user-id': session?.userId || '',
    });
  }
}
