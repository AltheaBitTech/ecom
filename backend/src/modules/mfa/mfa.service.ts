import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

import { SecretBox } from '../../common/crypto/secret-box';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const PENDING_TTL_SECONDS = 600; // 10 minutes to confirm enrollment
const TOTP_ISSUER = 'Auth & RBAC'; // no ecom config getter; source default
const BACKUP_CODE_COUNT = 10;
// SecretBox tokens are `v1:...`; anything else is treated as legacy plaintext.
const ENCRYPTED_PREFIX = 'v1:';

/**
 * TOTP-based MFA enrollment. Setup stashes a *pending* secret in Redis; it is
 * only persisted once the user proves possession with a valid code. On enable we
 * also mint single-use backup codes (shown once). The login-time challenge lives
 * in AuthService.verifyMfa.
 *
 * The persisted `mfaSecret` is encrypted at rest with SecretBox (AES-256-GCM);
 * backup codes are stored as SHA-256 hashes. Neither is ever serialized out.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly secretBox: SecretBox,
    private readonly tokenHash: TokenHashService,
  ) {}

  async setup(userId: string): Promise<{ secret: string; otpauth_url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.unauthenticated();
    if (user.mfaEnabled) throw AppException.conflict('mfa_already_enabled', 'MFA is already enabled for this account');

    const secret = authenticator.generateSecret();
    await this.redis.setJson(this.pendingKey(userId), { secret }, PENDING_TTL_SECONDS);
    const otpauthUrl = authenticator.keyuri(user.email, TOTP_ISSUER, secret);
    return { secret, otpauth_url: otpauthUrl };
  }

  async enable(userId: string, totpCode: string): Promise<{ mfa_enabled: true; backup_codes: string[] }> {
    const pending = await this.redis.getJson<{ secret: string }>(this.pendingKey(userId));
    if (!pending) throw AppException.validation('No pending MFA setup; start with mfa/setup');
    if (!authenticator.check(totpCode, pending.secret)) {
      throw new AppException('invalid_credentials', 'Invalid authentication code');
    }

    const { plain, hashes } = this.generateBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: this.secretBox.encrypt(pending.secret),
        mfaEnabled: true,
        mfaBackupCodes: hashes,
      },
    });
    await this.redis.del(this.pendingKey(userId));
    return { mfa_enabled: true, backup_codes: plain };
  }

  async disable(userId: string, totpCode: string): Promise<{ mfa_enabled: false }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw AppException.validation('MFA is not enabled for this account');
    }
    if (!this.checkTotp(user.mfaSecret, totpCode)) {
      throw new AppException('invalid_credentials', 'Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false, mfaBackupCodes: [] },
    });
    return { mfa_enabled: false };
  }

  /** Re-mint backup codes (invalidates the previous set); requires a live TOTP. */
  async regenerateBackupCodes(userId: string, totpCode: string): Promise<{ backup_codes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw AppException.validation('MFA is not enabled for this account');
    }
    if (!this.checkTotp(user.mfaSecret, totpCode)) {
      throw new AppException('invalid_credentials', 'Invalid authentication code');
    }

    const { plain, hashes } = this.generateBackupCodes();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: hashes } });
    return { backup_codes: plain };
  }

  /** Verify a TOTP against a stored (possibly legacy-plaintext) secret. */
  checkTotp(storedSecret: string, totpCode: string): boolean {
    const secret = storedSecret.startsWith(ENCRYPTED_PREFIX) ? this.secretBox.decrypt(storedSecret) : storedSecret;
    return authenticator.check(totpCode, secret);
  }

  /** SHA-256 hash a backup code for constant-shape comparison against stored hashes. */
  hashBackupCode(code: string): string {
    return this.tokenHash.hashRefreshToken(code.replace(/[\s-]/g, '').toLowerCase());
  }

  private generateBackupCodes(): { plain: string[]; hashes: string[] } {
    const plain: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const raw = randomBytes(5).toString('hex'); // 10 hex chars
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
      plain.push(formatted);
      hashes.push(this.hashBackupCode(formatted));
    }
    return { plain, hashes };
  }

  private pendingKey(userId: string): string {
    return `mfa:pending:${userId}`;
  }
}
