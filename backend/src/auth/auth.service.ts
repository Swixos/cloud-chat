import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RocketchatService, RcUser } from '../rocketchat/rocketchat.service';

@Injectable()
export class AuthService {
  private sessions = new Map<string, RcUser>();

  constructor(private rocketchatService: RocketchatService) {}

  /**
   * Authentifie un utilisateur via Rocket.Chat et stocke la session.
   */
  async login(username: string, password: string): Promise<RcUser & { wsUrl: string; rcUrl: string }> {
    try {
      const user = await this.rocketchatService.login(username, password);
      this.sessions.set(user.authToken, user);
      return {
        ...user,
        wsUrl: this.rocketchatService.getWebsocketUrl(),
        rcUrl: this.rocketchatService.getBaseUrl(),
      };
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  /**
   * Enregistre un nouvel utilisateur via Rocket.Chat.
   */
  async register(username: string, password: string, email: string, name: string): Promise<RcUser & { wsUrl: string; rcUrl: string }> {
    const user = await this.rocketchatService.register(username, password, email, name);
    this.sessions.set(user.authToken, user);
    return {
      ...user,
      wsUrl: this.rocketchatService.getWebsocketUrl(),
      rcUrl: this.rocketchatService.getBaseUrl(),
    };
  }

  /**
   * Déconnecte l'utilisateur.
   */
  async logout(authToken: string): Promise<void> {
    const user = this.sessions.get(authToken);
    if (user) {
      await this.rocketchatService.logout(user.userId, user.authToken);
      this.sessions.delete(authToken);
    }
  }

  /**
   * Valide un token et retourne la session associée.
   */
  validateToken(authToken: string): RcUser | null {
    return this.sessions.get(authToken) || null;
  }
}
