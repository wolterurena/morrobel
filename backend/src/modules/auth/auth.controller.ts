import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; pass: string }) {
    return this.authService.login(body.username, body.pass);
  }

  @Post('reset-request')
  async requestReset(@Body() body: { username: string; masterCode?: string }) {
    try {
      return await this.usersService.createResetRequest(body.username, body.masterCode);
    } catch (e: any) {
      throw new BadRequestException(e.message || 'Error al solicitar el restablecimiento');
    }
  }
}
