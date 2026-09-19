import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import type { EnvConfig } from '../config/env.validation';

export interface AccessTokenPayload {
  sub: string; // user id
  tenantId: string;
  email: string;
  // Permissions are deliberately NOT embedded here: they're re-read from the DB on
  // every request (see JwtAuthGuard) so a revoked permission or suspended account
  // takes effect immediately, not after the access token expires.
}

/** `register` has no tenantSlug — the workspace is created in the callback. */
export type OAuthState = { mode: 'login'; tenantSlug: string; codeVerifier?: string } | { mode: 'register'; codeVerifier?: string };

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Short-lived, signed round-trip state for an OAuth redirect: carries the tenant the login
   * started from (and, for PKCE providers, the code verifier) through the provider's redirect,
   * without needing server-side session storage. Signed so the callback can't be handed a
   * different tenantSlug than the one the user actually started from.
   */
  signOAuthState(payload: OAuthState): string {
    return this.jwt.sign(payload, { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }), expiresIn: '10m' });
  }

  verifyOAuthState(state: string): OAuthState {
    return this.jwt.verify(state, { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }) });
  }

  // Derived key so a reset token can never be replayed as an access/OAuth token (or vice versa).
  private resetSecret(): string {
    return `${this.config.get('JWT_ACCESS_SECRET', { infer: true })}:password-reset`;
  }

  /**
   * Stateless single-use reset token: `fp` fingerprints the current password hash, so the moment
   * the password changes every outstanding link stops verifying — no token table needed.
   */
  signPasswordResetToken(userId: string, passwordHash: string): string {
    return this.jwt.sign({ sub: userId, fp: this.fingerprint(passwordHash) }, { secret: this.resetSecret(), expiresIn: '30m' });
  }

  verifyPasswordResetToken(token: string): { sub: string; fp: string } {
    return this.jwt.verify(token, { secret: this.resetSecret() });
  }

  fingerprint(passwordHash: string): string {
    return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
  }

  /** Opaque, high-entropy refresh token. Only its hash is ever persisted. */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  hashRefreshToken(token: string): string {
    // HMAC over a server secret, not a raw digest: prevents offline guessing of the
    // stored hash from leaking a usable token, and is cheap enough for a lookup key
    // (unlike argon2/bcrypt, this must run once per refresh request, not just once per login).
    return crypto
      .createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }
}
