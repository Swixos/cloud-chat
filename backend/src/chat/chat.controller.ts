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
   * Retrieves the list of public channels joined by the user.
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns List of channels
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
   * Retrieves the message history of a channel.
   * @param roomId - Channel ID
   * @param authToken - Authentication token
   * @param userId - User ID
   * @param count - Maximum number of messages (default: 50)
   * @returns List of messages
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
   * Creates a new public channel.
   * @param body - Body containing the channel name
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns The created channel
   */
  @Post('channels')
  async createChannel(
    @Body() body: { name: string },
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    const channel = await this.rocketchatService.createChannel(body.name, userId, authToken);
    this.chatGateway.notifyNewConversation([], 'channel');
    return channel;
  }

  /**
   * Retrieves the user's DM conversation list.
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns List of DMs
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
   * Retrieves the message history of a DM conversation.
   * @param roomId - DM room ID
   * @param authToken - Authentication token
   * @param userId - User ID
   * @param count - Maximum number of messages (default: 50)
   * @returns List of messages
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
   * Opens or creates a DM conversation with a target user.
   * @param body - Body containing the target username
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns The DM room ID
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
   * Creates a private group with the specified members.
   * @param body - Body containing the group name and members
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns The created group
   * @throws {BadRequestException} If creation fails on the Rocket.Chat side
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
   * Retrieves the user's private groups.
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns List of private groups
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
   * Retrieves the message history of a private group.
   * @param roomId - Group ID
   * @param authToken - Authentication token
   * @param userId - User ID
   * @param count - Maximum number of messages (default: 50)
   * @returns List of messages
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
   * Retrieves the list of registered users (excluding rocket.cat bot).
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns List of users
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
   * Retrieves the connected user's profile information.
   * @param authToken - Authentication token
   * @param userId - User ID
   * @returns User profile data
   */
  @Get('me')
  async getMe(
    @Headers('x-auth-token') authToken: string,
    @Headers('x-user-id') userId: string,
  ) {
    this.validateHeaders(authToken, userId);
    return this.rocketchatService.me(userId, authToken);
  }

  /**
   * Validates the presence of authentication headers.
   * @param authToken - Authentication token
   * @param userId - User ID
   * @throws {UnauthorizedException} If a header is missing
   */
  private validateHeaders(authToken: string, userId: string) {
    if (!authToken || !userId) {
      throw new UnauthorizedException('Missing authentication headers');
    }
  }
}
