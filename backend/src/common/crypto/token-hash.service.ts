import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config';

/**
 * Fast, deterministic hashing for high-entropy secrets — refresh tokens and
 * internal keys. These are NOT passwords: they are already 256+ bits of
 * randomness, so a slow KDF (Argon2) is unnecessary and would only add latency
 * to hot paths (every token refresh). A keyed HMAC over a random secret is the
 * right tool and lets us look rows up by exact hash.
 */
@Injectable()
export class TokenHashService {
  private readonly apiKeySecret: string;

  constructor(config: AppConfig) {
    this.apiKeySecret = config.apiKeyHashSecret;
  }

  /** Generate a cryptographically-random opaque token (URL-safe). */
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** SHA-256 of a refresh token, stored so a DB leak never exposes live tokens. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Keyed HMAC-SHA256 of an opaque key, using the server secret. */
  hashApiKey(rawKey: string): string {
    return createHmac('sha256', this.apiKeySecret).update(rawKey).digest('hex');
  }

  /** Constant-time comparison of two hex digests of equal length. */
  safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
