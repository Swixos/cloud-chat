import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { RocketchatService } from '../rocketchat/rocketchat.service';
import { AuthService } from '../auth/auth.service';

@Controller('chat')
export class ChatController {
  constructor(
    private rocketchatService: RocketchatService,
    private authService: AuthService,
  ) {}

  /**
   * Récupère la liste des channels rejoints par l'utilisateur.
   */
  @Get('channels')
  async getChannels(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getChannels(userId, authToken);
  }

  /**
   * Récupère l'historique des messages d'un channel.
   */
  @Get('messages')
  async getMessages(
    @Query('roomId') roomId: string,
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
    @Query('count') count?: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getMessages(roomId, userId, authToken, count ? +count : 50);
  }

  /**
   * Crée un nouveau channel.
   */
  @Post('channels')
  async createChannel(
    @Body() body: { name: string },
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.createChannel(body.name, userId, authToken);
  }

  /**
   * Récupère la liste des DMs de l'utilisateur.
   */
  @Get('dm')
  async getDirectMessages(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getDirectMessages(userId, authToken);
  }

  /**
   * Récupère l'historique d'un DM.
   */
  @Get('dm/history')
  async getDmHistory(
    @Query('roomId') roomId: string,
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
    @Query('count') count?: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getDmHistory(roomId, userId, authToken, count ? +count : 50);
  }

  /**
   * Envoie un DM à un utilisateur.
   */
  @Post('dm')
  async sendDirectMessage(
    @Body() body: { targetUsername: string; message: string },
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.sendDirectMessage(
      body.targetUsername,
      body.message,
      userId,
      authToken,
    );
  }

  /**
   * Récupère les informations de l'utilisateur connecté.
   */
  @Get('me')
  async getMe(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.me(userId, authToken);
  }

  private validateHeaders(authToken: string, userId: string) {
    if (!authToken || !userId) {
      throw new UnauthorizedException('Missing authentication headers');
    }
  }
}
