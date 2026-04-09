import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { UserSession } from '../models/message.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sessionSignal = signal<UserSession | null>(this.loadSession());

  session = this.sessionSignal.asReadonly();
  isLoggedIn = computed(() => !!this.sessionSignal());

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Logs in the user via the NestJS / Rocket.Chat backend.
   * @param username - Username
   * @param password - Password
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
   * Registers a new user then logs them in automatically.
   * @param username - Desired username
   * @param password - Chosen password
   * @param email - Email address
   * @param name - Full name
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
   * Logs out the user, removes the local session, and redirects to /login.
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

  /**
   * Persists the user session in localStorage.
   * @param session - Session to save
   */
  private setSession(session: UserSession): void {
    localStorage.setItem('chat_session', JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  /**
   * Loads the user session from localStorage.
   * @returns The session or `null` if absent
   */
  private loadSession(): UserSession | null {
    const data = localStorage.getItem('chat_session');
    return data ? JSON.parse(data) : null;
  }
}
