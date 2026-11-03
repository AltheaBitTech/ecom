import { Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app-exception';
import { buildPage, decodeCursor, encodeCursor, type Page } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';

import { AuditQueryDto, UserDirectoryQueryDto } from './dto/platform.dto';

const DEFAULT_LIMIT = 25;

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  is_platform_admin: boolean;
  created_at: Date;
}

/**
 * Platform-operator surface: a global staff-user directory, the cross-tenant
 * audit log, and headline stats. Reads that touch tenant-scoped tables go
 * through the platform RLS bypass (asPlatform), which is legitimate here because
 * every caller is a platform admin. Global tables (users, sessions) are queried
 * on the base client — they are not RLS-scoped.
 */
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: UserDirectoryQueryDto): Promise<Page<UserSummary>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query.q ? { email: { contains: query.q.toLowerCase() } } : {}),
        ...(query.cursor ? { id: { gt: decodeCursor(query.cursor) } } : {}),
      },
      include: { platformAdmin: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    return buildPage(rows, limit, toUserSummary) as Page<UserSummary>;
  }

  async getUser(userId: string): Promise<UserSummary & { memberships: unknown[] }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { platformAdmin: true },
    });
    if (!user) throw AppException.notFound('User not found');

    const memberships = await this.prisma.asPlatform((tx) =>
      tx.userTenantRole.findMany({
        where: { userId, deletedAt: null },
        include: { tenant: true, role: true },
      }),
    );

    return {
      ...toUserSummary(user),
      memberships: memberships.map((m) => ({
        tenant_id: m.tenantId,
        tenant: m.tenant.name,
        role: m.role.name,
        type: m.type,
        status: m.status,
      })),
    };
  }

  async listAudit(query: AuditQueryDto): Promise<Page<Record<string, unknown>>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    // Newest-first; cursor walks backwards by id.
    const rows = await this.prisma.asPlatform((tx) =>
      tx.auditLog.findMany({
        where: {
          ...(query.action ? { action: query.action } : {}),
          ...(query.tenant_id ? { tenantId: query.tenant_id } : {}),
          ...(query.cursor ? { id: { lt: decodeCursor(query.cursor) } } : {}),
        },
        orderBy: { id: 'desc' },
        take: limit + 1,
      }),
    );

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    return {
      data: data.map((e) => ({
        id: e.id,
        tenant_id: e.tenantId,
        actor_kind: e.actorKind,
        actor_id: e.actorId,
        action: e.action,
        target: e.target,
        method: e.method,
        route: e.route,
        status_code: e.statusCode,
        request_id: e.requestId,
        ip_address: e.ipAddress,
        metadata: e.metadata,
        created_at: e.createdAt,
      })),
      next_cursor: hasMore && last ? encodeCursor(last.id) : null,
      has_more: hasMore,
    };
  }

  async stats(): Promise<Record<string, number>> {
    const now = new Date();
    const [users, tenants, activeSessions] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.asPlatform((tx) => tx.tenant.count()),
      this.prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    return { users, tenants, active_sessions: activeSessions };
  }
}

function toUserSummary(u: {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  platformAdmin: unknown | null;
}): UserSummary {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    email_verified: u.emailVerified,
    mfa_enabled: u.mfaEnabled,
    is_platform_admin: u.platformAdmin != null,
    created_at: u.createdAt,
  };
}
