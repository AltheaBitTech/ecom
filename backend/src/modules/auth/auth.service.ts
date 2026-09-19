import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/auth/audit.service';
import { TokenService } from '../../common/auth/token.service';
import type { EnvConfig } from '../../common/config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { RolesService } from '../roles/roles.service';
import { TenantsService } from '../tenants/tenants.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterTenantDto } from './dto/register-tenant.dto';
import type { OAuthProviderName } from './oauth-providers';

const PROVIDER_LABEL: Record<OAuthProviderName, string> = {
  google: 'Google',
  facebook: 'Facebook',
  microsoft: 'Microsoft',
  twitter: 'X (Twitter)',
};

const OWNER_ROLE_NAME = 'Tenant Owner';

/** Parses simple "30d" / "15m" / "12h" durations, as accepted by JWT_REFRESH_TTL. */
function parseDurationMs(input: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const value = Number(match[1]);
  const unitMs = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
  return value * unitMs;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tenant: { id: string; name: string; slug: string; status: string };
  user: { id: string; email: string };
}

function assertPasswordStrength(password: string) {
  const checks = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/];
  const passed = checks.filter((re) => re.test(password)).length;
  if (passed < 3) {
    throw new ConflictException('Password must include at least 3 of: lowercase, uppercase, digit, symbol');
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly roles: RolesService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly referrals: ReferralsService,
    private readonly notifications: NotificationsService,
  ) {}

  async registerTenant(dto: RegisterTenantDto, meta: { ip?: string; userAgent?: string }): Promise<AuthResult> {
    assertPasswordStrength(dto.password);

    const tenant = await this.tenants.create(dto.businessName, {
      gstin: dto.gstin,
      legalName: dto.legalName,
      pan: dto.pan,
    });
    await this.roles.seedSystemRoles(tenant.id);

    const passwordHash = await argon2.hash(dto.password);
    const scoped = this.prisma.forTenant(tenant.id);
    const ownerRole = await scoped.role.findFirst({ where: { name: OWNER_ROLE_NAME } });
    const user = await scoped.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.ownerEmail.toLowerCase(),
        passwordHash,
        roles: { create: { roleId: ownerRole!.id } },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'tenant.register',
      resourceType: 'Tenant',
      resourceId: tenant.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.referrals.createReferral(tenant.id, dto.referralCode);
    void this.notifications.notifyWelcome(user.email, tenant.name);

    return this.issueSession(tenant, user);
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }): Promise<AuthResult> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    const genericError = () => new UnauthorizedException('Invalid credentials');

    if (!tenant || ['SUSPENDED', 'DEACTIVATED', 'REJECTED'].includes(tenant.status)) {
      await this.audit.log({
        action: 'auth.login',
        resourceType: 'User',
        actorEmail: dto.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
        success: false,
      });
      throw genericError();
    }

    const user = await this.prisma.forTenant(tenant.id).user.findFirst({ where: { email: dto.email.toLowerCase() } });

    // A social-only account has no password to check against — tell them where to go instead
    // of a confusing "invalid credentials" for a password that was never set.
    if (user && user.authProvider !== 'PASSWORD') {
      throw new ConflictException(`You signed up with ${PROVIDER_LABEL[user.authProvider.toLowerCase() as OAuthProviderName]}. Please continue with that instead.`);
    }

    const valid = user?.passwordHash ? await argon2.verify(user.passwordHash, dto.password).catch(() => false) : false;

    if (!user || !valid || user.status !== 'ACTIVE') {
      await this.audit.log({
        tenantId: tenant.id,
        action: 'auth.login',
        resourceType: 'User',
        actorEmail: dto.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
        success: false,
      });
      throw genericError();
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      resourceType: 'User',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueSession(tenant, user);
  }

  /**
   * Logs an existing tenant user in via a social provider. Deliberately does NOT auto-create
   * an account: an email that isn't already a user of this tenant is rejected, same as a
   * stranger typing a random email into the password login form would be — otherwise anyone
   * who knows (or guesses) a workspace slug could self-provision into it via OAuth.
   */
  async socialLogin(
    tenantSlug: string,
    provider: OAuthProviderName,
    email: string | undefined,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    if (!email) {
      throw new ConflictException(`${PROVIDER_LABEL[provider]} didn't share an email address with this app.`);
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || ['SUSPENDED', 'DEACTIVATED', 'REJECTED'].includes(tenant.status)) {
      throw new UnauthorizedException('Workspace not found');
    }

    const user = await this.prisma.forTenant(tenant.id).user.findFirst({ where: { email: email.toLowerCase() } });
    const providerEnum = provider.toUpperCase() as 'GOOGLE' | 'FACEBOOK' | 'MICROSOFT' | 'TWITTER';

    if (!user || user.status !== 'ACTIVE') {
      await this.audit.log({
        tenantId: tenant.id,
        action: 'auth.login',
        resourceType: 'User',
        actorEmail: email,
        ip: meta.ip,
        userAgent: meta.userAgent,
        success: false,
      });
      throw new UnauthorizedException('No account found for you in this workspace');
    }

    // The core ask: one email, one provider. A password user trying Google (or a Google user
    // trying Facebook) is rejected and told exactly which provider they actually signed up with.
    if (user.authProvider !== providerEnum) {
      throw new ConflictException(
        `You signed up with ${PROVIDER_LABEL[user.authProvider.toLowerCase() as OAuthProviderName] ?? 'a password'}. Please continue with that instead.`,
      );
    }

    await this.audit.log({
      tenantId: tenant.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      resourceType: 'User',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueSession(tenant, user);
  }

  /**
   * OAuth signup: the provider proves the email, we create an isolated workspace with that
   * user as Owner (no password, authProvider = provider). Business/legal/tax details are
   * filled in afterwards on /onboarding. If this email + provider already owns a workspace,
   * sign them into it instead of minting a duplicate.
   */
  async socialRegister(
    provider: OAuthProviderName,
    email: string | undefined,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    if (!email) {
      throw new ConflictException(`${PROVIDER_LABEL[provider]} didn't share a verified email address with this app.`);
    }
    const providerEnum = provider.toUpperCase() as 'GOOGLE' | 'FACEBOOK' | 'MICROSOFT' | 'TWITTER';
    const normalized = email.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { email: normalized, authProvider: providerEnum, status: 'ACTIVE', tenant: { status: { notIn: ['SUSPENDED', 'DEACTIVATED', 'REJECTED'] } } },
      include: { tenant: true },
    });
    if (existing) return this.socialLogin(existing.tenant.slug, provider, email, meta);

    // Placeholder name (email local part) — replaced during onboarding.
    const tenant = await this.tenants.create(normalized.split('@')[0]);
    await this.roles.seedSystemRoles(tenant.id);
    const scoped = this.prisma.forTenant(tenant.id);
    const ownerRole = await scoped.role.findFirst({ where: { name: OWNER_ROLE_NAME } });
    const user = await scoped.user.create({
      data: { tenantId: tenant.id, email: normalized, authProvider: providerEnum, roles: { create: { roleId: ownerRole!.id } } },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'tenant.register',
      resourceType: 'Tenant',
      resourceId: tenant.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    void this.notifications.notifyWelcome(user.email, tenant.name);
    return this.issueSession(tenant, user);
  }

  /**
   * Always resolves the same way whether or not the email matches an account, so this can't be
   * used to discover who has one. Only password accounts get a link — OAuth users have no
   * password to reset (they sign in with their provider).
   */
  async forgotPassword(email: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { email: email.toLowerCase(), authProvider: 'PASSWORD', status: 'ACTIVE', passwordHash: { not: null }, tenant: { status: { notIn: ['SUSPENDED', 'DEACTIVATED', 'REJECTED'] } } },
      include: { tenant: { select: { name: true } } },
    });
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    for (const user of users) {
      const token = this.tokens.signPasswordResetToken(user.id, user.passwordHash!);
      void this.notifications.notifyPasswordReset(user.email, user.tenant.name, `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`);
    }
  }

  async resetPassword(token: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<void> {
    const invalid = () => new UnauthorizedException('This reset link is invalid or has expired.');
    let payload: { sub: string; fp: string };
    try {
      payload = this.tokens.verifyPasswordResetToken(token);
    } catch {
      throw invalid();
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // fp no longer matching means the password already changed (link already used) — reject.
    if (!user || user.status !== 'ACTIVE' || !user.passwordHash || this.tokens.fingerprint(user.passwordHash) !== payload.fp) throw invalid();

    assertPasswordStrength(password);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(password) } });
    // A reset is often a "someone else may have my password" moment: sign every session out.
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.password_reset',
      resourceType: 'User',
      resourceId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async refresh(refreshTokenPlain: string): Promise<AuthResult> {
    const tokenHash = this.tokens.hashRefreshToken(refreshTokenPlain);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: { tenant: true } } } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: revoke the used token immediately, whether or not the request succeeds further.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    if (stored.user.status !== 'ACTIVE' || ['SUSPENDED', 'DEACTIVATED', 'REJECTED'].includes(stored.user.tenant.status)) {
      throw new UnauthorizedException('Account or tenant is not active');
    }

    return this.issueSession(stored.user.tenant, stored.user);
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshTokenPlain);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueSession(
    tenant: { id: string; name: string; slug: string; status: string },
    user: { id: string; email: string },
  ): Promise<AuthResult> {
    const accessToken = this.tokens.signAccessToken({ sub: user.id, tenantId: tenant.id, email: user.email });
    const refreshToken = this.tokens.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(this.config.get('JWT_REFRESH_TTL', { infer: true }))),
      },
    });
    return { accessToken, refreshToken, tenant, user: { id: user.id, email: user.email } };
  }
}
