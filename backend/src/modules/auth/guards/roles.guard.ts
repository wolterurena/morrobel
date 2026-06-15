import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * RolesGuard restricts access based on the user's role.
 * - Users with the 'admin' role have unrestricted access.
 * - Non-admin users are only allowed to access the 'work-orders' (conduce) endpoints.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Allow any public auth routes (e.g., login, password reset) without authentication
    const url = request.originalUrl || request.url || '';
    if (url.includes('/auth')) {
      return true;
    }

    if (!user) {
      // No authentication information present for protected routes
      throw new ForbiddenException('Usuario no autenticado');
    }

    // The JWT payload includes a `role` field (string name of the role)
    const roleName = typeof user.role === 'string' ? user.role : user.role?.name;

    // Admins can access any route
    if (roleName === 'admin') {
      return true;
    }

    // Non‑admin users may only access the "conduce" area (work‑orders routes)
    if (url.includes('/work-orders') || url.includes('/conduces')) {
      return true;
    }

    // Anything else is forbidden
    throw new ForbiddenException('Acceso restringido: solo administradores pueden acceder a esta área');
  }
}
