import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config';

/**
 * Authenticated symmetric encryption for secrets we must store but never expose
 * — per-tenant payment gateway keys, webhook secrets. AES-256-GCM with a random
 * 96-bit nonce per message and the GCM auth tag, so ciphertext is tamper-evident.
 *
 * The master key comes from APP_ENCRYPTION_KEY (32 raw bytes, base64). Tenant
 * secrets are DATA encrypted under it; rotating the master key re-encrypts them.
 *
 * Token format (all base64url, `:`-joined, versioned so the scheme can evolve):
 *   v1:<iv>:<authTag>:<ciphertext>
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.key = Buffer.from(config.encryptionKey, 'base64');
    if (this.key.length !== 32) {
      throw new Error('APP_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of a 256-bit key).');
    }
  }

  /** Encrypt UTF-8 plaintext into a self-describing, tamper-evident token. */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', b64u(iv), b64u(tag), b64u(ciphertext)].join(':');
  }

  /** Decrypt a token produced by {@link encrypt}. Throws if it was tampered with. */
  decrypt(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Malformed secret token.');
    }
    const [, iv, tag, ciphertext] = parts;
    const decipher = createDecipheriv('aes-256-gcm', this.key, fromB64u(iv));
    decipher.setAuthTag(fromB64u(tag));
    return Buffer.concat([decipher.update(fromB64u(ciphertext)), decipher.final()]).toString('utf8');
  }

  /** Constant-time comparison of two secrets (e.g. a computed vs supplied HMAC). */
  static safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}

const b64u = (buf: Buffer): string => buf.toString('base64url');
const fromB64u = (s: string): Buffer => Buffer.from(s, 'base64url');
