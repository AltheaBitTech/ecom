import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, MembershipStatus, MembershipType } from '@prisma/client';

import { PasswordService } from '../../common/crypto/password.service';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { EmailService } from '../../common/email/email.service';
import { AppException } from '../../common/errors/app-exception';
import { JwtService } from '../../common/jwt/jwt.service';
import type { MembershipTypeClaim } from '../../common/jwt/jwt.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { MfaService } from '../mfa/mfa.service';
import { RbacService } from '../rbac/rbac.service';

import { RegisterDto } from './dto/auth.dto';
import { SessionService } from './session.service';

// --- Login hardening constants (no ecom config getters; source defaults) -----
const LOCKOUT_WINDOW_SECONDS = 900; // 15 min
const LOCKOUT_THRESHOLD = 10; // failed attempts before temporary lock
const LOGIN_SESSION_TTL = 300; // 5 min to complete MFA
const RESET_TOKEN_TTL = 1800; // 30 min
const EMAIL_VERIFY_TTL = 24 * 60 * 60; // 24 hours

export interface RequestMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * The staff login/refresh outcome the controller forwards. A refresh token is
 * returned only on full success — never on an MFA challenge step, when it is null.
 */
export interface StaffLoginResult {
  access_token?: string;
  expires_in?: number;
  mfa_required?: boolean;
  login_session_id?: string;
  user?: { id: string; email: string; tenant_id: string; role: string; type: MembershipTypeClaim };
}

export interface StaffLoginOutcome {
  result: StaffLoginResult;
  refreshToken: string | null;
}

interface ResolvedMembership {
  roleId: string;
  roleName: string;
  type: MembershipTypeClaim;
}

interface LoginSessionData {
  userId: string;
  tenantId: string;
  membership: ResolvedMembership;
}

/**
 * Staff (merchant admin) authentication: registration, email verification,
 * password login with Redis-backed lockout + TOTP MFA, refresh-token rotation,
 * logout, session listing, and password reset. Identity tables (`users`,
 * `sessions`) are global; tenant membership + roles are read under RLS.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly redis: RedisService,
    private readonly tokenHash: TokenHashService,
    private readonly email: EmailService,
    private readonly mfa: MfaService,
    private readonly rbac: RbacService,
  ) {}

  // --- Registration ----------------------------------------------------------
  async register(dto: RegisterDto): Promise<{ user_id: string; email: string; email_verified: boolean }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppException.conflict('email_taken', 'An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name ?? null,
        passwordHash: await this.passwords.hash(dto.password),
        passwordPepperVersion: this.passwords.pepperVersion,
        identities: {
          create: { provider: AuthProvider.PASSWORD, providerUserId: randomUUID(), emailAtLink: email },
        },
      },
    });

    await this.dispatchVerificationEmail(user.id, user.email);
    return { user_id: user.id, email: user.email, email_verified: user.emailVerified };
  }

  // --- Email verification ----------------------------------------------------
  async verifyEmail(rawToken: string): Promise<{ email_verified: true }> {
    const key = this.emailVerifyKey(rawToken);
    const data = await this.redis.getJson<{ userId: string }>(key);
    if (!data) throw AppException.validation('Invalid or expired verification token');

    await this.prisma.user.update({ where: { id: data.userId }, data: { emailVerified: true } });
    await this.redis.del(key);
    return { email_verified: true };
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Never reveal whether the email exists or is already verified.
    if (!user || user.emailVerified) return;
    await this.dispatchVerificationEmail(user.id, user.email);
  }

  private async dispatchVerificationEmail(userId: string, email: string): Promise<void> {
    const rawToken = this.tokenHash.randomToken();
    await this.redis.setJson(this.emailVerifyKey(rawToken), { userId }, EMAIL_VERIFY_TTL);
    try {
      await this.email.sendEmailVerification(email, rawToken);
    } catch (err) {
      // Registration must not fail because the mail provider is momentarily down;
      // the user can request a resend.
      this.logger.error(`Failed to send verification email to ${email}`, err instanceof Error ? err.stack : undefined);
    }
  }

  // --- Login -----------------------------------------------------------------
  async login(tenantId: string, email: string, password: string, meta: RequestMeta): Promise<StaffLoginOutcome> {
    const normalizedEmail = email.toLowerCase();
    await this.assertNotLockedOut(normalizedEmail);

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const passwordOk = user?.passwordHash ? await this.passwords.verify(user.passwordHash, password) : false;

    if (!user || !passwordOk || user.deletedAt) {
      await this.recordFailedLogin(normalizedEmail);
      // Identical response whether the email exists or not — no user enumeration.
      throw new AppException('invalid_credentials', 'Invalid email or password');
    }
    await this.clearFailedLogins(normalizedEmail);

    // Opportunistic pepper rotation on successful login.
    if (this.passwords.needsRehash(user.passwordPepperVersion)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await this.passwords.hash(password),
          passwordPepperVersion: this.passwords.pepperVersion,
        },
      });
    }

    const membership = await this.resolveStaffMembership(tenantId, user.id);

    // MFA gate before any token is issued.
    if (user.mfaEnabled) {
      const loginSessionId = `ls_${randomUUID()}`;
      const data: LoginSessionData = { userId: user.id, tenantId, membership };
      await this.redis.setJson(this.loginSessionKey(loginSessionId), data, LOGIN_SESSION_TTL);
      return { result: { mfa_required: true, login_session_id: loginSessionId }, refreshToken: null };
    }

    return this.issueForMembership(user.id, user.email, tenantId, membership, meta);
  }

  // --- MFA challenge completion ----------------------------------------------
  async verifyMfa(loginSessionId: string, totpCode: string, meta: RequestMeta): Promise<StaffLoginOutcome> {
    const key = this.loginSessionKey(loginSessionId);
    const data = await this.redis.getJson<LoginSessionData>(key);
    if (!data) throw AppException.unauthenticated('Login session expired; please sign in again');

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user?.mfaSecret) throw AppException.unauthenticated('MFA is not configured for this account');

    const totpOk = this.mfa.checkTotp(user.mfaSecret, totpCode);
    if (!totpOk && !(await this.consumeBackupCode(user.id, user.mfaBackupCodes, totpCode))) {
      throw new AppException('invalid_credentials', 'Invalid authentication code');
    }

    await this.redis.del(key);
    return this.issueForMembership(user.id, user.email, data.tenantId, data.membership, meta);
  }

  // --- Refresh ---------------------------------------------------------------
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<StaffLoginOutcome> {
    if (!rawToken) throw AppException.unauthenticated('Missing refresh token');

    const rotated = await this.sessions.rotate(rawToken, meta);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.deletedAt) throw AppException.unauthenticated();

    if (!rotated.tenantId) throw AppException.unauthenticated('Session is not bound to a tenant');
    const membership = await this.resolveStaffMembership(rotated.tenantId, user.id);

    const permissions = await this.rbac.resolvePermissions(rotated.tenantId, membership.roleId);
    const { token, expiresIn } = await this.jwt.issueAccessToken({
      userId: user.id,
      tenantId: rotated.tenantId,
      role: membership.roleName,
      permissions,
      type: membership.type,
      sessionId: rotated.sessionId,
    });

    return {
      result: {
        access_token: token,
        expires_in: expiresIn,
        mfa_required: false,
        user: {
          id: user.id,
          email: user.email,
          tenant_id: rotated.tenantId,
          role: membership.roleName,
          type: membership.type,
        },
      },
      refreshToken: rotated.refreshToken,
    };
  }

  // --- Logout & sessions -----------------------------------------------------
  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.sessions.revokeByToken(rawToken);
  }

  async listSessions(userId: string) {
    const sessions = await this.sessions.listActive(userId);
    return sessions.map((s) => ({
      id: s.id,
      ip_address: s.ipAddress,
      user_agent: s.userAgent,
      created_at: s.createdAt,
      last_used_at: s.lastUsedAt,
      expires_at: s.expiresAt,
    }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.sessions.revoke(sessionId, userId);
  }

  // --- Password reset --------------------------------------------------------
  async forgotPassword(email: string, _meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always behave identically — never reveal whether the email exists.
    if (!user?.passwordHash) return;

    const rawToken = this.tokenHash.randomToken();
    await this.redis.setJson(this.resetKey(rawToken), { userId: user.id }, RESET_TOKEN_TTL);

    try {
      await this.email.sendPasswordReset(user.email, rawToken);
    } catch (err) {
      // Never surface a delivery failure — that would break the identical-response
      // guarantee that prevents email enumeration.
      this.logger.error('Failed to send password-reset email', err instanceof Error ? err.stack : undefined);
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const key = this.resetKey(rawToken);
    const data = await this.redis.getJson<{ userId: string }>(key);
    if (!data) throw AppException.validation('Invalid or expired reset token');

    await this.prisma.user.update({
      where: { id: data.userId },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        passwordPepperVersion: this.passwords.pepperVersion,
      },
    });
    await this.redis.del(key);
    // Force re-authentication everywhere after a password change.
    await this.sessions.revokeAllForUser(data.userId);
  }

  // --- Internals -------------------------------------------------------------
  private async issueForMembership(
    userId: string,
    email: string,
    tenantId: string,
    membership: ResolvedMembership,
    meta: RequestMeta,
  ): Promise<StaffLoginOutcome> {
    const permissions = await this.rbac.resolvePermissions(tenantId, membership.roleId);
    const session = await this.sessions.issue({
      userId,
      tenantId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const { token, expiresIn } = await this.jwt.issueAccessToken({
      userId,
      tenantId,
      role: membership.roleName,
      permissions,
      type: membership.type,
      sessionId: session.sessionId,
    });

    return {
      result: {
        access_token: token,
        expires_in: expiresIn,
        mfa_required: false,
        user: { id: userId, email, tenant_id: tenantId, role: membership.roleName, type: membership.type },
      },
      refreshToken: session.refreshToken,
    };
  }

  /** The user's active STAFF membership in the tenant, read under RLS. */
  private async resolveStaffMembership(tenantId: string, userId: string): Promise<ResolvedMembership> {
    const membership = await this.prisma.forTenant(tenantId, (tx) =>
      tx.userTenantRole.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { role: true },
      }),
    );
    if (
      !membership ||
      membership.deletedAt ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.type !== MembershipType.STAFF
    ) {
      throw AppException.permissionDenied('This account has no active staff access to this store');
    }
    return {
      roleId: membership.roleId,
      roleName: membership.role.name,
      type: 'staff',
    };
  }

  /**
   * If `code` matches one of the user's unused backup codes, consume it (remove
   * from the stored set) and return true. Comparison is over SHA-256 hashes.
   */
  private async consumeBackupCode(userId: string, storedHashes: string[], code: string): Promise<boolean> {
    if (storedHashes.length === 0) return false;
    const candidate = this.mfa.hashBackupCode(code);
    const match = storedHashes.some((h) => this.tokenHash.safeEquals(h, candidate));
    if (!match) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: storedHashes.filter((h) => h !== candidate) },
    });
    return true;
  }

  private async assertNotLockedOut(email: string): Promise<void> {
    const count = await this.redis.getJson<number>(this.lockoutKey(email));
    if (count && count >= LOCKOUT_THRESHOLD) {
      throw new AppException('rate_limited', 'Too many failed attempts. Try again later.');
    }
  }

  private async recordFailedLogin(email: string): Promise<void> {
    await this.redis.incrWithTtl(this.lockoutKey(email), LOCKOUT_WINDOW_SECONDS);
  }

  private async clearFailedLogins(email: string): Promise<void> {
    await this.redis.del(this.lockoutKey(email));
  }

  private lockoutKey(email: string): string {
    return `login:fail:${email}`;
  }
  private loginSessionKey(id: string): string {
    return `login:session:${id}`;
  }
  private resetKey(rawToken: string): string {
    return `pwreset:${this.tokenHash.hashRefreshToken(rawToken)}`;
  }
  private emailVerifyKey(rawToken: string): string {
    return `emailverify:${this.tokenHash.hashRefreshToken(rawToken)}`;
  }
}
