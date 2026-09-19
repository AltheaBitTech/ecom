import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PlatformTokenService } from './platform-token.service';
import type { PlatformAuthContext } from './platform-request-context';

/** Same shape as JwtAuthGuard but for platform admins — a separate identity, not a tenant User. */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly tokens: PlatformTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = this.tokens.verify(header.slice('Bearer '.length));
      const auth: PlatformAuthContext = { adminId: payload.sub, email: payload.email };
      (req as Request & { platformAuth: PlatformAuthContext }).platformAuth = auth;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
