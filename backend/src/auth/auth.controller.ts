import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Authenticates a user with their credentials.
   * @param dto - Login credentials (username, password)
   * @returns Session credentials with URLs
   */
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  /**
   * Registers a new user.
   * @param dto - Registration data (username, password, email, name)
   * @returns Session credentials with URLs
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password, dto.email, dto.name);
  }

  /**
   * Logs out the user and invalidates their session.
   * @param body - Body containing the authentication token
   * @returns Confirmation object `{ success: true }`
   */
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() body: { authToken: string }) {
    await this.authService.logout(body.authToken);
    return { success: true };
  }
}
