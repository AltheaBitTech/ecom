import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../common/auth/token.service';
import { AuthService } from './auth.service';

const TENANT = { id: 't1', name: 'Acme', slug: 'acme', status: 'ACTIVE' };

function makeService(user: { authProvider: string; status: string } | null) {
  const prisma = {
    tenant: { findUnique: async () => TENANT },
    forTenant: () => ({ user: { findFirst: async () => (user ? { id: 'u1', email: 'a@b.com', ...user } : null) } } as never),
    refreshToken: { create: async () => undefined },
  };
  const audit = { log: async () => undefined };
  const tokens = {
    signAccessToken: () => 'access',
    generateRefreshToken: () => 'refresh',
    hashRefreshToken: () => 'hash',
  };
  const config = { get: (key: string) => (key === 'JWT_REFRESH_TTL' ? '30d' : undefined) };
  const referrals = { createReferral: async () => undefined };
  const notifications = { notifyWelcome: async () => undefined };
  return new AuthService(prisma as never, {} as never, {} as never, tokens as never, audit as never, config as never, referrals as never, notifications as never);
}

describe('AuthService.socialLogin', () => {
  it('logs in a user whose account provider matches', async () => {
    const service = makeService({ authProvider: 'GOOGLE', status: 'ACTIVE' });
    const result = await service.socialLogin('acme', 'google', 'a@b.com', {});
    expect(result.accessToken).toBe('access');
  });

  it('rejects a provider mismatch and names the real provider', async () => {
    const service = makeService({ authProvider: 'PASSWORD', status: 'ACTIVE' });
    await expect(service.socialLogin('acme', 'google', 'a@b.com', {})).rejects.toThrow(/password/i);
  });

  it('rejects when the OAuth profile carries no email', async () => {
    const service = makeService({ authProvider: 'GOOGLE', status: 'ACTIVE' });
    await expect(service.socialLogin('acme', 'twitter', undefined, {})).rejects.toThrow(/email/i);
  });

  it('rejects an email with no matching user in the workspace (no auto-provisioning)', async () => {
    const service = makeService(null);
    await expect(service.socialLogin('acme', 'google', 'a@b.com', {})).rejects.toThrow(/no account/i);
  });
});

describe('AuthService.socialRegister', () => {
  function makeRegisterService(existing: { tenant: typeof TENANT } | null) {
    const created: Record<string, unknown>[] = [];
    const prisma = {
      user: { findFirst: async () => existing },
      tenant: { findUnique: async () => TENANT },
      forTenant: () =>
        ({
          role: { findFirst: async () => ({ id: 'r1' }) },
          user: {
            findFirst: async () => ({ id: 'u1', email: 'a@b.com', authProvider: 'GOOGLE', status: 'ACTIVE' }),
            create: async ({ data }: { data: Record<string, unknown> }) => (created.push(data), { id: 'u2', email: data.email }),
          },
        }) as never,
      refreshToken: { create: async () => undefined },
    };
    const tenants = { create: async () => TENANT };
    const roles = { seedSystemRoles: async () => undefined };
    const tokens = { signAccessToken: () => 'access', generateRefreshToken: () => 'refresh', hashRefreshToken: () => 'hash' };
    const config = { get: () => '30d' };
    const service = new AuthService(prisma as never, tenants as never, roles as never, tokens as never, { log: async () => undefined } as never, config as never, {} as never, { notifyWelcome: async () => undefined } as never);
    return { service, created };
  }

  it('creates an owner with the provider and no password', async () => {
    const { service, created } = makeRegisterService(null);
    const result = await service.socialRegister('google', 'A@B.com', {});
    expect(result.accessToken).toBe('access');
    expect(created[0]).toMatchObject({ email: 'a@b.com', authProvider: 'GOOGLE' });
    expect(created[0]).not.toHaveProperty('passwordHash');
  });

  it('signs into the existing workspace instead of duplicating it', async () => {
    const { service, created } = makeRegisterService({ tenant: TENANT });
    await service.socialRegister('google', 'a@b.com', {});
    expect(created).toHaveLength(0);
  });

  it('rejects when the provider shares no (verified) email', async () => {
    const { service } = makeRegisterService(null);
    await expect(service.socialRegister('twitter', undefined, {})).rejects.toThrow(/email/i);
  });
});

describe('AuthService password reset', () => {
  function build(initialHash = 'hash-1') {
    const user = { id: 'u1', tenantId: 't1', email: 'a@b.com', status: 'ACTIVE', authProvider: 'PASSWORD', passwordHash: initialHash, tenant: { name: 'Acme' } };
    const revoked: unknown[] = [];
    const prisma = {
      user: {
        findMany: async ({ where }: { where: { authProvider: string } }) => (where.authProvider === 'PASSWORD' ? [user] : []),
        findUnique: async () => user,
        update: async ({ data }: { data: { passwordHash: string } }) => { user.passwordHash = data.passwordHash; return user; },
      },
      refreshToken: { updateMany: async (a: unknown) => { revoked.push(a); } },
    };
    const links: string[] = [];
    const notifications = { notifyPasswordReset: async (_e: string, _n: string, url: string) => { links.push(url); }, notifyWelcome: async () => undefined };
    const config = { get: (k: string) => ({ JWT_ACCESS_SECRET: 'secret-secret-secret-secret-secret', FRONTEND_URL: 'https://app' })[k] };
    const tokens = new TokenService(new JwtService(), config as never);
    const service = new AuthService(prisma as never, {} as never, {} as never, tokens, { log: async () => undefined } as never, config as never, {} as never, notifications as never);
    const tokenFromLink = () => decodeURIComponent(links.at(-1)!.split('token=')[1]);
    return { service, user, links, revoked, tokenFromLink, tokens };
  }

  it('emails a link, and a reset link works exactly once', async () => {
    const { service, links, tokenFromLink, revoked, user } = build();
    await service.forgotPassword('A@B.com');
    expect(links[0]).toMatch(/^https:\/\/app\/reset-password\?token=/);
    const token = tokenFromLink();
    await service.resetPassword(token, 'Str0ng!Passw0rd#2', {});
    expect(user.passwordHash).not.toBe('hash-1');
    expect(revoked).toHaveLength(1); // every session signed out
    await expect(service.resetPassword(token, 'An0ther!Passw0rd#3', {})).rejects.toThrow(/invalid or has expired/);
  });

  it('rejects weak passwords, garbage tokens, and access-style tokens', async () => {
    const { service, links, tokenFromLink } = build();
    await service.forgotPassword('a@b.com');
    await expect(service.resetPassword(tokenFromLink(), 'alllowercaseletters', {})).rejects.toThrow(/at least 3 of/);
    await expect(service.resetPassword('not-a-real-token-not-a-real-token', 'Str0ng!Passw0rd#2', {})).rejects.toThrow(/invalid or has expired/);
    expect(links).toHaveLength(1);
  });

  it('sends nothing (and does not error) for an unknown or OAuth-only email', async () => {
    const { service, links } = build();
    const noMatch = new AuthService({ user: { findMany: async () => [] } } as never, {} as never, {} as never, {} as never, {} as never, { get: () => 'https://app' } as never, {} as never, { notifyPasswordReset: async () => links.push('x') } as never);
    await expect(noMatch.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(links).toHaveLength(0);
    await expect(service.forgotPassword('a@b.com')).resolves.toBeUndefined();
  });
});

