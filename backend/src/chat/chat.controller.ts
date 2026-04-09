import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { RocketchatService } from '../rocketchat/rocketchat.service';
import { AuthService } from '../auth/auth.service';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
export class ChatController {
  constructor(
    private rocketchatService: RocketchatService,
    private authService: AuthService,
    private chatGateway: ChatGateway,
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
   * Ouvre ou cree un DM avec un utilisateur.
   */
  @Post('dm')
  async createDm(
    @Body() body: { targetUsername: string },
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    const result = await this.rocketchatService.createDirectMessage(body.targetUsername, userId, authToken);
    this.chatGateway.notifyNewConversation([body.targetUsername], 'dm');
    return result;
  }

  /**
   * Cree un groupe prive.
   */
  @Post('groups')
  async createGroup(
    @Body() body: { name: string; members: string[] },
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    try {
      const group = await this.rocketchatService.createGroup(body.name, body.members, userId, authToken);
      this.chatGateway.notifyNewConversation(body.members, 'group');
      return group;
    } catch (err: any) {
      const rcError = err?.response?.data?.error || 'Erreur lors de la création du groupe';
      throw new BadRequestException(rcError);
    }
  }

  /**
   * Recupere les groupes prives.
   */
  @Get('groups')
  async getGroups(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getGroups(userId, authToken);
  }

  /**
   * Recupere l'historique d'un groupe prive.
   */
  @Get('groups/history')
  async getGroupHistory(
    @Query('roomId') roomId: string,
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
    @Query('count') count?: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.getGroupHistory(roomId, userId, authToken, count ? +count : 50);
  }

  /**
   * Recupere la liste des utilisateurs enregistres.
   */
  @Get('users')
  async getUsers(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    const users = await this.rocketchatService.getUsers(userId, authToken);
    return users.filter(u => u.username !== 'rocket.cat');
  }

  /**
   * Recupere les informations de l'utilisateur connecte.
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
