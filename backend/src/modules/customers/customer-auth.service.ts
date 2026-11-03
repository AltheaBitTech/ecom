import { Injectable, Logger } from '@nestjs/common';
import { CustomerStatus, TenantStatus } from '@prisma/client';

import { PasswordService } from '../../common/crypto/password.service';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { EmailService } from '../../common/email/email.service';
import { AppException } from '../../common/errors/app-exception';
import { JwtService } from '../../common/jwt/jwt.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

import { CustomerSessionService } from './customer-session.service';

// --- Login hardening (per store + email, so one store can't lock out another) --
// These have no AppConfig getter, so we hold the former auth-rbac defaults here.
const LOCKOUT_WINDOW_SECONDS = 900; // 15 min
const LOCKOUT_THRESHOLD = 10;
const EMAIL_VERIFY_TTL = 24 * 60 * 60; // 24 hours

interface RequestMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

interface SignupInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

/**
 * The access-token bundle handed back to the storefront. The rotated refresh
 * token is returned SEPARATELY (see the method return types) so the controller
 * can plant it in an httpOnly cookie — it is never a body field.
 */
export interface CustomerTokens {
  access_token: string;
  expires_in: number;
  customer: { id: string; email: string; tenant_id: string; email_verified: boolean };
}

/** A token bundle paired with the raw refresh token to set as a cookie. */
export interface CustomerTokenResult {
  tokens: CustomerTokens;
  refreshToken: string | null;
}

/**
 * Self-service authentication for END CUSTOMERS (shoppers), scoped to a single
 * store (tenant). A customer is a tenant-scoped identity (Customer model), NOT a
 * global User — so all reads/writes go through the tenant RLS context
 * (forTenant), and the same email is an independent account at every store.
 *
 * `customer_sessions` is NOT RLS-scoped (looked up by token hash), so the
 * CustomerSessionService reaches it on the base client.
 */
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly sessions: CustomerSessionService,
    private readonly redis: RedisService,
    private readonly tokenHash: TokenHashService,
    private readonly email: EmailService,
  ) {}

  // --- Signup ----------------------------------------------------------------
  async signup(
    tenantId: string,
    input: SignupInput,
  ): Promise<{ customer_id: string; email: string; email_verified: boolean }> {
    const email = input.email.toLowerCase();

    const customer = await this.prisma.forTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { id: tenantId } });
      if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
        throw AppException.notFound('Store not found');
      }

      const existing = await tx.customer.findUnique({ where: { tenantId_email: { tenantId, email } } });
      if (existing && !existing.deletedAt) {
        throw AppException.conflict('email_taken', 'An account with this email already exists at this store');
      }

      const data = {
        tenantId,
        email,
        name: input.name ?? null,
        phone: input.phone ?? null,
        passwordHash: await this.passwords.hash(input.password),
        passwordPepperVersion: this.passwords.pepperVersion,
        status: CustomerStatus.ACTIVE,
      };
      // Re-signup on a soft-deleted account revives that row rather than colliding.
      return existing
        ? tx.customer.update({
            where: { id: existing.id },
            data: { ...data, deletedAt: null, emailVerified: false },
          })
        : tx.customer.create({ data });
    });

    await this.dispatchVerificationEmail(customer.id, tenantId, customer.email);

    return { customer_id: customer.id, email: customer.email, email_verified: customer.emailVerified };
  }

  // --- Login -----------------------------------------------------------------
  async login(tenantId: string, input: LoginInput, meta: RequestMeta): Promise<CustomerTokenResult> {
    const email = input.email.toLowerCase();
    await this.assertNotLockedOut(tenantId, email);

    const customer = await this.prisma.forTenant(tenantId, (tx) =>
      tx.customer.findFirst({ where: { tenantId, email, deletedAt: null } }),
    );
    const passwordOk = customer?.passwordHash
      ? await this.passwords.verify(customer.passwordHash, input.password)
      : false;

    if (!customer || !passwordOk) {
      await this.recordFailedLogin(tenantId, email);
      // Identical response whether the email exists or not — no enumeration.
      throw new AppException('invalid_credentials', 'Invalid email or password');
    }
    if (customer.status !== CustomerStatus.ACTIVE) {
      throw AppException.permissionDenied('This account has been suspended');
    }
    await this.clearFailedLogins(tenantId, email);

    // Opportunistic pepper rotation on successful login, plus last-login stamp.
    const rehash = this.passwords.needsRehash(customer.passwordPepperVersion)
      ? { passwordHash: await this.passwords.hash(input.password), passwordPepperVersion: this.passwords.pepperVersion }
      : {};
    await this.prisma.forTenant(tenantId, (tx) =>
      tx.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date(), ...rehash } }),
    );

    return this.issueTokens(customer.id, customer.email, tenantId, customer.emailVerified, meta);
  }

  // --- Refresh ---------------------------------------------------------------
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<CustomerTokenResult> {
    if (!rawToken) throw AppException.unauthenticated('Missing refresh token');

    const rotated = await this.sessions.rotate(rawToken, meta);

    const customer = await this.prisma.forTenant(rotated.tenantId, (tx) =>
      tx.customer.findFirst({ where: { id: rotated.customerId, deletedAt: null } }),
    );
    if (!customer || customer.status !== CustomerStatus.ACTIVE) {
      await this.sessions.revokeAllForCustomer(rotated.customerId);
      throw AppException.unauthenticated('Account is no longer active');
    }

    const { token, expiresIn } = await this.issueAccessToken(customer.id, rotated.tenantId);
    return {
      tokens: {
        access_token: token,
        expires_in: expiresIn,
        customer: {
          id: customer.id,
          email: customer.email,
          tenant_id: rotated.tenantId,
          email_verified: customer.emailVerified,
        },
      },
      refreshToken: rotated.refreshToken,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.sessions.revokeByToken(rawToken);
  }

  // --- Email verification ----------------------------------------------------
  async verifyEmail(rawToken: string): Promise<{ email_verified: true }> {
    const key = this.emailVerifyKey(rawToken);
    const data = await this.redis.getJson<{ customerId: string; tenantId: string }>(key);
    if (!data) throw AppException.validation('Invalid or expired verification token');

    await this.prisma.forTenant(data.tenantId, (tx) =>
      tx.customer.update({ where: { id: data.customerId }, data: { emailVerified: true } }),
    );
    await this.redis.del(key);
    return { email_verified: true };
  }

  async resendVerification(tenantId: string, email: string): Promise<void> {
    const customer = await this.prisma.forTenant(tenantId, (tx) =>
      tx.customer.findFirst({ where: { tenantId, email: email.toLowerCase(), deletedAt: null } }),
    );
    // Never reveal whether the email exists or is already verified.
    if (!customer || customer.emailVerified) return;
    await this.dispatchVerificationEmail(customer.id, tenantId, customer.email);
  }

  // --- Internals -------------------------------------------------------------
  private async issueTokens(
    customerId: string,
    email: string,
    tenantId: string,
    emailVerified: boolean,
    meta: RequestMeta,
  ): Promise<CustomerTokenResult> {
    const { refreshToken } = await this.sessions.issue({
      customerId,
      tenantId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
    const { token, expiresIn } = await this.issueAccessToken(customerId, tenantId);
    return {
      tokens: {
        access_token: token,
        expires_in: expiresIn,
        customer: { id: customerId, email, tenant_id: tenantId, email_verified: emailVerified },
      },
      refreshToken,
    };
  }

  private issueAccessToken(customerId: string, tenantId: string) {
    // No `sid`: customer tokens are verified locally and are short-lived;
    // revocation is via the refresh session rather than session introspection.
    // Customers carry no RBAC role/permissions — the `customer` type is what
    // storefront authorization keys on.
    return this.jwt.issueAccessToken({
      userId: customerId,
      tenantId,
      role: '',
      permissions: [],
      type: 'customer',
    });
  }

  private async dispatchVerificationEmail(customerId: string, tenantId: string, email: string): Promise<void> {
    const rawToken = this.tokenHash.randomToken();
    await this.redis.setJson(this.emailVerifyKey(rawToken), { customerId, tenantId }, EMAIL_VERIFY_TTL);
    try {
      await this.email.sendEmailVerification(email, rawToken);
    } catch (err) {
      this.logger.error(`Failed to send customer verification email`, err instanceof Error ? err.stack : undefined);
    }
  }

  private async assertNotLockedOut(tenantId: string, email: string): Promise<void> {
    const count = await this.redis.getJson<number>(this.lockoutKey(tenantId, email));
    if (count && count >= LOCKOUT_THRESHOLD) {
      throw new AppException('rate_limited', 'Too many failed attempts. Try again later.');
    }
  }

  private async recordFailedLogin(tenantId: string, email: string): Promise<void> {
    await this.redis.incrWithTtl(this.lockoutKey(tenantId, email), LOCKOUT_WINDOW_SECONDS);
  }

  private async clearFailedLogins(tenantId: string, email: string): Promise<void> {
    await this.redis.del(this.lockoutKey(tenantId, email));
  }

  private lockoutKey(tenantId: string, email: string): string {
    return `custlogin:fail:${tenantId}:${email}`;
  }
  private emailVerifyKey(rawToken: string): string {
    return `customerverify:${this.tokenHash.hashRefreshToken(rawToken)}`;
  }
}
