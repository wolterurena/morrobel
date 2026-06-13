import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByUsername(username);
    if (user && user.password) {
      let isValid = false;
      // if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      isValid = await bcrypt.compare(pass, user.password);
      console.log('Clave hasheada', user.password, isValid);
      // } else {
      //   // Plaintext password fallback
      //   isValid = user.password === pass;
      //   console.log('Clave no hasheada', user.password, isValid);
      //   if (isValid) {
      //     // Lazy migration: hash password and update user in database
      //     const hashedPassword = await bcrypt.hash(pass, 10);
      //     await this.usersService.update(user.id, { password: hashedPassword });
      //   }
      // }
      if (isValid) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(username: string, pass: string) {
    const user = await this.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }
}
