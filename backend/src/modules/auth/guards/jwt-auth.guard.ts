import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const url = request.originalUrl || request.url || '';
    // Allow public auth routes (e.g., /auth/login) without a token
    if (url.includes('/auth')) {
      return true;
    }
    // Otherwise delegate to the default JWT guard behavior
    return super.canActivate(context);
  }
}
