import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { RocketchatService, RcUser } from '../rocketchat/rocketchat.service';

@Injectable()
export class AuthService {
  private sessions = new Map<string, RcUser>();

  constructor(private rocketchatService: RocketchatService) {}

  /**
   * Authenticates a user via Rocket.Chat and stores the session in memory.
   * @param username - Rocket.Chat username
   * @param password - User password
   * @returns User credentials with WebSocket and Rocket.Chat URLs
   * @throws {UnauthorizedException} If the credentials are invalid
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
   * Registers a new user via Rocket.Chat then authenticates them.
   * @param username - Desired username
   * @param password - Chosen password
   * @param email - User email address
   * @param name - User full name
   * @returns User credentials with WebSocket and Rocket.Chat URLs
   * @throws {BadRequestException} If registration fails (duplicate, validation...)
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
   * Logs out the user and removes their session from the cache.
   * @param authToken - Authentication token of the session to close
   */
  async logout(authToken: string): Promise<void> {
    const user = this.sessions.get(authToken);
    if (user) {
      await this.rocketchatService.logout(user.userId, user.authToken);
      this.sessions.delete(authToken);
    }
  }

  /**
   * Validates an authentication token by checking the local cache then Rocket.Chat.
   * @param authToken - Authentication token to validate
   * @param userId - User ID associated with the token
   * @returns The authenticated user or `null` if the token is invalid
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
