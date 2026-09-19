import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformTokenService } from './platform-token.service';
import type { PlatformLoginDto } from './dto/platform-login.dto';

const REVIEWABLE = ['PENDING_VERIFICATION', 'PROFILE_INCOMPLETE', 'UNDER_REVIEW', 'REVISION_REQUESTED'];

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: PlatformTokenService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email.toLowerCase() } });
    const valid = admin ? await argon2.verify(admin.passwordHash, dto.password).catch(() => false) : false;
    if (!admin || !valid) throw new UnauthorizedException('Invalid credentials');
    return { accessToken: this.tokens.sign({ sub: admin.id, email: admin.email }) };
  }

  listTenants(status?: string) {
    return this.prisma.tenant.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async approve(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    if (!REVIEWABLE.includes(tenant.status) && tenant.status !== 'APPROVED') {
      throw new ConflictException(`Cannot approve a tenant with status ${tenant.status}`);
    }
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
    void this.notifications.notifyTenantReview(tenantId, 'approved');
    return updated;
  }

  async reject(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    if (!REVIEWABLE.includes(tenant.status)) {
      throw new ConflictException(`Cannot reject a tenant with status ${tenant.status}`);
    }
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'REJECTED' } });
    void this.notifications.notifyTenantReview(tenantId, 'rejected');
    return updated;
  }

  async requestRevision(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.status !== 'UNDER_REVIEW') {
      throw new ConflictException(`Cannot request revision on a tenant with status ${tenant.status}`);
    }
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'REVISION_REQUESTED' } });
    void this.notifications.notifyTenantReview(tenantId, 'revision_requested');
    return updated;
  }

  async suspend(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.status === 'SUSPENDED') throw new ConflictException('Tenant is already suspended');
    return this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
  }

  async reactivate(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.status !== 'SUSPENDED') throw new ConflictException('Only a suspended tenant can be reactivated');
    return this.prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } });
  }

  async analyticsOverview() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const [tenantsByStatus, activeSubscriptions, orderAgg, recentTenants] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: { select: { priceCents: true } } } }),
      this.prisma.order.aggregate({ _count: { _all: true }, _sum: { totalCents: true } }),
      this.prisma.tenant.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

    const mrrCents = activeSubscriptions.reduce((sum, s) => sum + s.plan.priceCents, 0);

    // ponytail: build the 30-day series in JS (30 buckets, tiny data) instead of a SQL date_trunc — fine at this scale.
    const signupsByDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      signupsByDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const t of recentTenants) {
      const key = t.createdAt.toISOString().slice(0, 10);
      signupsByDay.set(key, (signupsByDay.get(key) ?? 0) + 1);
    }

    return {
      tenantsByStatus: Object.fromEntries(tenantsByStatus.map((r) => [r.status, r._count._all])),
      totalTenants: tenantsByStatus.reduce((sum, r) => sum + r._count._all, 0),
      activeSubscriptions: activeSubscriptions.length,
      mrrCents,
      totalOrders: orderAgg._count._all,
      gmvCents: orderAgg._sum.totalCents ?? 0,
      signups30d: Array.from(signupsByDay, ([date, count]) => ({ date, count })),
    };
  }

  async analyticsTenants(page = 1, pageSize = 25) {
    const skip = (page - 1) * pageSize;
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          subscription: { select: { status: true, plan: { select: { name: true } } } },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    const tenantIds = tenants.map((t) => t.id);
    const orderStats = tenantIds.length
      ? await this.prisma.order.groupBy({
          by: ['tenantId'],
          where: { tenantId: { in: tenantIds } },
          _count: { _all: true },
          _sum: { totalCents: true },
        })
      : [];
    const statsByTenant = new Map(orderStats.map((s) => [s.tenantId, s]));

    return {
      data: tenants.map((t) => {
        const stats = statsByTenant.get(t.id);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          createdAt: t.createdAt,
          orderCount: stats?._count._all ?? 0,
          gmvCents: stats?._sum.totalCents ?? 0,
          subscriptionStatus: t.subscription?.status ?? null,
          planName: t.subscription?.plan.name ?? null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }
}
