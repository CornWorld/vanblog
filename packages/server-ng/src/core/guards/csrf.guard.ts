import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface RequestWithCsrf extends Request {
  csrfToken(): string;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCsrf>();

    // Skip CSRF check for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // For other methods, CSRF protection is handled by the csurf middleware
    // If we reach here, it means the CSRF token was valid
    // (otherwise csurf middleware would have thrown an error)
    return true;
  }
}
