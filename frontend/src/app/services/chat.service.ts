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
   * Récupère la liste des channels rejoints.
   */
  async getChannels(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/channels`, { headers: this.headers() })
    );
  }

  /**
   * Récupère l'historique des messages d'un channel.
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
   * Crée un nouveau channel.
   */
  async createChannel(name: string): Promise<RcChannel> {
    return firstValueFrom(
      this.http.post<RcChannel>(`${API}/chat/channels`, { name }, { headers: this.headers() })
    );
  }

  /**
   * Récupère les DMs.
   */
  async getDirectMessages(): Promise<RcChannel[]> {
    return firstValueFrom(
      this.http.get<RcChannel[]>(`${API}/chat/dm`, { headers: this.headers() })
    );
  }

  /**
   * Récupère l'historique d'un DM.
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
   * Envoie un DM.
   */
  async sendDirectMessage(targetUsername: string, message: string): Promise<RcMessage> {
    return firstValueFrom(
      this.http.post<RcMessage>(`${API}/chat/dm`, { targetUsername, message }, { headers: this.headers() })
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
