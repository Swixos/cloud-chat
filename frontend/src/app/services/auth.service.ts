import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserSession } from '../models/message.model';

const API = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionSignal = signal<UserSession | null>(this.loadSession());

  session = this.sessionSignal.asReadonly();
  isLoggedIn = computed(() => !!this.sessionSignal());

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Connecte l'utilisateur via le backend NestJS / Rocket.Chat.
   */
  async login(username: string, password: string): Promise<void> {
    const session = await this.http
      .post<UserSession>(`${API}/auth/login`, { username, password })
      .toPromise();
    if (session) {
      this.setSession(session);
      this.router.navigate(['/chat']);
    }
  }

  /**
   * Enregistre un nouvel utilisateur.
   */
  async register(username: string, password: string, email: string, name: string): Promise<void> {
    const session = await this.http
      .post<UserSession>(`${API}/auth/register`, { username, password, email, name })
      .toPromise();
    if (session) {
      this.setSession(session);
      this.router.navigate(['/chat']);
    }
  }

  /**
   * Déconnecte l'utilisateur.
   */
  logout(): void {
    const session = this.sessionSignal();
    if (session) {
      this.http.post(`${API}/auth/logout`, { authToken: session.authToken }).subscribe();
    }
    localStorage.removeItem('chat_session');
    this.sessionSignal.set(null);
    this.router.navigate(['/login']);
  }

  private setSession(session: UserSession): void {
    localStorage.setItem('chat_session', JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  private loadSession(): UserSession | null {
    const data = localStorage.getItem('chat_session');
    return data ? JSON.parse(data) : null;
  }
}
