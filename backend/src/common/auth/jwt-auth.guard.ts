import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TokenService } from './token.service';
import type { AuthContext } from './request-context';

/**
 * Verifies the access token, then re-reads the user's live status/roles from the DB
 * (not from the token) so a suspension or permission change applies on the very next
 * request — see the comment on AccessTokenPayload for why.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice('Bearer '.length);

    let payload;
    try {
      payload = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId },
      include: { roles: { include: { role: true } }, tenant: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if (['SUSPENDED', 'DEACTIVATED', 'REJECTED'].includes(user.tenant.status)) {
      throw new UnauthorizedException('Tenant is suspended or deactivated');
    }

    const permissions = Array.from(new Set(user.roles.flatMap((ur) => ur.role.permissions)));

    const auth: AuthContext = { userId: user.id, tenantId: user.tenantId, email: user.email, permissions };
    (req as Request & { auth: AuthContext }).auth = auth;
    return true;
  }
}
