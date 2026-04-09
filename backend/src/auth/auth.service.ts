import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
    try {
      const user = await this.rocketchatService.register(username, password, email, name);
      this.sessions.set(user.authToken, user);
      return {
        ...user,
        wsUrl: this.rocketchatService.getWebsocketUrl(),
        rcUrl: this.rocketchatService.getBaseUrl(),
      };
    } catch (err: any) {
      const rcError = err?.response?.data;
      if (rcError?.error) {
        throw new BadRequestException(rcError.error, { description: rcError.details?.map((d: any) => d.message).join(', ') });
      }
      throw new BadRequestException('Registration failed');
    }
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
   * Valide un token en verifiant aupres de Rocket.Chat si necessaire.
   */
  async validateToken(authToken: string, userId: string): Promise<RcUser | null> {
    const cached = this.sessions.get(authToken);
    if (cached) return cached;

    try {
      const me = await this.rocketchatService.me(userId, authToken);
      const user: RcUser = { userId, authToken, username: me.username };
      this.sessions.set(authToken, user);
      return user;
    } catch {
      return null;
    }
  }
}
