import { Injectable, Logger } from '@nestjs/common';
import type { Session } from '@prisma/client';

import { AppConfig } from '../../common/config/app-config';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface IssueSessionInput {
  userId: string;
  tenantId: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface IssuedSession {
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
}

export interface RotatedSession {
  userId: string;
  tenantId: string | null;
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Manages refresh-token sessions (one row per device/login). The raw token is
 * returned once for the caller to set as an httpOnly cookie; only its SHA-256
 * hash is stored. Sessions are a GLOBAL table (not under RLS), so all access is
 * via the base client.
 *
 * Rotation: every refresh mints a new token and revokes the old one, linking
 * them via `replacedById`. Presenting an already-rotated (revoked/replaced) token
 * is treated as theft — the entire session lineage for that user is revoked.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly refreshTtl: number;

  constructor(
    config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly tokenHash: TokenHashService,
  ) {
    this.refreshTtl = config.refreshTokenTtl;
  }

  async issue(input: IssueSessionInput): Promise<IssuedSession> {
    const rawToken = this.tokenHash.randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId ?? null,
        refreshTokenHash: this.tokenHash.hashRefreshToken(rawToken),
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });
    return { refreshToken: rawToken, sessionId: session.id, expiresAt: session.expiresAt };
  }

  /**
   * Rotate a presented refresh token. Throws `unauthenticated` when the token is
   * unknown or expired, and — on reuse of an already revoked/replaced token —
   * revokes the whole lineage for that user before throwing.
   */
  async rotate(
    rawToken: string,
    meta: { userAgent?: string | null; ipAddress?: string | null },
  ): Promise<RotatedSession> {
    const hash = this.tokenHash.hashRefreshToken(rawToken);
    const existing = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });
    if (!existing) throw AppException.unauthenticated('Invalid or expired refresh token');

    // Reuse of an already-rotated/revoked token => probable theft. Nuke the lineage.
    if (existing.revokedAt || existing.replacedById) {
      this.logger.warn(`Refresh token reuse detected for user ${existing.userId}; revoking all sessions.`);
      await this.revokeAllForUser(existing.userId);
      throw AppException.unauthenticated('Refresh token reuse detected; all sessions revoked');
    }

    if (existing.expiresAt < new Date()) {
      throw AppException.unauthenticated('Invalid or expired refresh token');
    }

    const next = await this.issue({
      userId: existing.userId,
      tenantId: existing.tenantId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.prisma.session.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: next.sessionId, lastUsedAt: new Date() },
    });

    return {
      userId: existing.userId,
      tenantId: existing.tenantId,
      sessionId: next.sessionId,
      refreshToken: next.refreshToken,
      expiresAt: next.expiresAt,
    };
  }

  async revokeByToken(rawToken: string): Promise<void> {
    const hash = this.tokenHash.hashRefreshToken(rawToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listActive(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
