import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  /**
   * Endpoint de connexion utilisateur.
   */
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('register')
  /**
   * Endpoint d'enregistrement utilisateur.
   */
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password, dto.email, dto.name);
  }

  @Post('logout')
  @HttpCode(200)
  /**
   * Endpoint de déconnexion utilisateur.
   */
  async logout(@Body() body: { authToken: string }) {
    await this.authService.logout(body.authToken);
    return { success: true };
  }
}
