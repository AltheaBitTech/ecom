import { Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app-exception';
import { JwtService } from '../../common/jwt/jwt.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export type IntrospectionResult =
  | { active: false }
  | {
      active: true;
      sub: string;
      tenant_id: string;
      role: string;
      permissions: string[];
      type: string;
      session_id?: string;
      exp: number;
    };

/**
 * Server-to-server token operations. Introspection confirms a token is still live
 * — respecting session revocation, which local JWT verification alone cannot see;
 * revoke ends a specific session.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async introspect(rawToken: string): Promise<IntrospectionResult> {
    let claims;
    try {
      claims = await this.jwt.verifyAccessToken(rawToken);
    } catch {
      return { active: false };
    }

    // Honor targeted session revocation — the reason introspection exists.
    if (claims.sid) {
      const session = await this.prisma.session.findUnique({ where: { id: claims.sid } });
      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        return { active: false };
      }
    }

    return {
      active: true,
      sub: claims.sub,
      tenant_id: claims.tenant_id,
      role: claims.role,
      permissions: claims.permissions ?? [],
      type: claims.type,
      session_id: claims.sid,
      exp: claims.exp,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw AppException.notFound('Session not found');
    if (!session.revokedAt) {
      await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    }
  }
}
