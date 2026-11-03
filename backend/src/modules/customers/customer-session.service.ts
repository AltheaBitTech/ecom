import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../../common/config/app-config';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Everything needed to open a fresh refresh-token session for a shopper. */
export interface CustomerSessionContext {
  customerId: string;
  tenantId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

/** The one-time raw refresh token plus the durable session facts a caller needs. */
export interface IssuedCustomerSession {
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
}

/** A rotated session — the customer/tenant it belongs to and the new raw token. */
export interface RotatedCustomerSession {
  customerId: string;
  tenantId: string;
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Refresh-token sessions for end customers — the CustomerSession equivalent of
 * the staff SessionService. The raw token is returned once (set as an httpOnly
 * cookie); only its SHA-256 hash is stored. Every refresh rotates the token and
 * revokes the old one; presenting an already-rotated token revokes the lineage
 * (theft signal).
 *
 * Rows are looked up by their unique token hash, so `customer_sessions` is NOT
 * RLS-scoped (mirroring the staff Session table) — every query runs on the base
 * client, never through forTenant(). Each row still carries its own tenantId.
 */
@Injectable()
export class CustomerSessionService {
  private readonly logger = new Logger(CustomerSessionService.name);
  private readonly refreshTtl: number;

  constructor(
    config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly tokenHash: TokenHashService,
  ) {
    this.refreshTtl = config.refreshTokenTtl;
  }

  async issue(ctx: CustomerSessionContext): Promise<IssuedCustomerSession> {
    const refreshToken = this.tokenHash.randomToken();
    const session = await this.prisma.customerSession.create({
      data: {
        customerId: ctx.customerId,
        tenantId: ctx.tenantId,
        refreshTokenHash: this.tokenHash.hashRefreshToken(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });
    return { refreshToken, sessionId: session.id, expiresAt: session.expiresAt };
  }

  /**
   * Rotate a presented refresh token. Throws `unauthenticated` if the token is
   * unknown, expired, or already revoked — and if it was already revoked, that
   * is refresh reuse (stolen token), so the whole customer's session lineage is
   * revoked before we throw.
   */
  async rotate(
    rawToken: string,
    meta: { userAgent?: string | null; ipAddress?: string | null },
  ): Promise<RotatedCustomerSession> {
    const hash = this.tokenHash.hashRefreshToken(rawToken);
    const existing = await this.prisma.customerSession.findUnique({ where: { refreshTokenHash: hash } });
    if (!existing) throw AppException.unauthenticated('Invalid or expired refresh token');

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      if (existing.revokedAt) {
        this.logger.warn(`Customer refresh reuse detected for customer ${existing.customerId}; revoking sessions.`);
        await this.revokeAllForCustomer(existing.customerId);
      }
      throw AppException.unauthenticated('Invalid or expired refresh token');
    }

    const next = await this.issue({
      customerId: existing.customerId,
      tenantId: existing.tenantId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    await this.prisma.customerSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: next.sessionId, lastUsedAt: new Date() },
    });

    return {
      customerId: existing.customerId,
      tenantId: existing.tenantId,
      sessionId: next.sessionId,
      refreshToken: next.refreshToken,
      expiresAt: next.expiresAt,
    };
  }

  async revokeByToken(rawToken: string): Promise<void> {
    const hash = this.tokenHash.hashRefreshToken(rawToken);
    await this.prisma.customerSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForCustomer(customerId: string): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
