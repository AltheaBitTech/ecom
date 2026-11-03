import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { AuthProvider, MembershipStatus, MembershipType } from '@prisma/client';

import { PasswordService } from '../../common/crypto/password.service';
import { TokenHashService } from '../../common/crypto/token-hash.service';
import { EmailService } from '../../common/email/email.service';
import { AppException } from '../../common/errors/app-exception';
import { buildPage, decodeCursor, type Page } from '../../common/http/pagination';
import { PrismaService, type Tx } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

import { AcceptInviteDto, InviteStaffDto, UpdateMembershipDto } from './dto/staff.dto';

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

/** The actor performing a mutation (a signed-in staff member). */
export interface Actor {
  userId: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface MemberView {
  membership_id: string;
  user_id: string;
  email: string;
  name: string | null;
  role_id: string;
  role: string;
  type: MembershipType;
  status: MembershipStatus;
  created_at: Date;
}

interface InvitePayload {
  membershipId: string;
  userId: string;
  tenantId: string;
}

/**
 * Tenant membership management: list members, invite new staff (creating the
 * global user if needed), accept invites, change a member's role, and remove a
 * member. All tenant reads/writes go through the tenant RLS context.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly tokenHash: TokenHashService,
    private readonly email: EmailService,
  ) {}

  async listMembers(tenantId: string, query: ListQuery): Promise<Page<MemberView>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.userTenantRole.findMany({
        where: { tenantId, deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) },
        include: { user: true, role: true },
        orderBy: { id: 'asc' },
        take: limit + 1,
      }),
    );
    return buildPage(rows, limit, toMemberView) as Page<MemberView>;
  }

  async invite(tenantId: string, dto: InviteStaffDto, _actor: Actor): Promise<MemberView> {
    const email = dto.email.toLowerCase();

    // The role must exist in this tenant; fetch the tenant name for the email.
    const context = await this.prisma.forTenant(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: dto.role_id, tenantId, deletedAt: null } });
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { role, tenantName: tenant?.name ?? 'your workspace' };
    });
    const role = context.role;
    if (!role) throw AppException.validation('role_id does not reference a role in this tenant');

    const user = await this.prisma.user.upsert({
      where: { email },
      update: dto.name ? { name: dto.name } : {},
      create: { email, name: dto.name ?? null },
    });

    const membership = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.userTenantRole.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        include: { user: true, role: true },
      });
      if (existing && !existing.deletedAt && existing.status === MembershipStatus.ACTIVE) {
        throw AppException.conflict('already_member', 'That user is already an active member of this tenant');
      }
      if (existing) {
        return tx.userTenantRole.update({
          where: { id: existing.id },
          data: {
            roleId: role.id,
            type: dto.type ?? MembershipType.STAFF,
            status: MembershipStatus.INVITED,
            deletedAt: null,
          },
          include: { user: true, role: true },
        });
      }
      return tx.userTenantRole.create({
        data: {
          userId: user.id,
          tenantId,
          roleId: role.id,
          type: dto.type ?? MembershipType.STAFF,
          status: MembershipStatus.INVITED,
        },
        include: { user: true, role: true },
      });
    });

    const rawToken = this.tokenHash.randomToken();
    const payload: InvitePayload = { membershipId: membership.id, userId: user.id, tenantId };
    await this.redis.setJson(this.inviteKey(rawToken), payload, INVITE_TTL_SECONDS);

    try {
      await this.email.sendStaffInvite(email, rawToken, context.tenantName);
    } catch (err) {
      // The membership row already exists; a failed email can be retried by
      // re-inviting rather than rolling everything back.
      this.logger.error(`Failed to send invite email to ${email}`, err instanceof Error ? err.stack : undefined);
    }

    return toMemberView(membership);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ status: 'ok'; tenant_id: string }> {
    const key = this.inviteKey(dto.token);
    const payload = await this.redis.getJson<InvitePayload>(key);
    if (!payload) throw AppException.unauthenticated('Invalid or expired invite');

    const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw AppException.unauthenticated('Invalid or expired invite');

    // First-time users must set a password; returning users need not.
    if (!user.passwordHash) {
      if (!dto.password) throw AppException.validation('A password is required to accept this invite');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await this.passwords.hash(dto.password),
          passwordPepperVersion: this.passwords.pepperVersion,
          emailVerified: true,
          ...(dto.name ? { name: dto.name } : {}),
          identities: {
            create: { provider: AuthProvider.PASSWORD, providerUserId: randomUUID(), emailAtLink: user.email },
          },
        },
      });
    } else if (dto.name && !user.name) {
      await this.prisma.user.update({ where: { id: user.id }, data: { name: dto.name } });
    }

    await this.prisma.forTenant(payload.tenantId, (tx) =>
      tx.userTenantRole.update({
        where: { id: payload.membershipId },
        data: { status: MembershipStatus.ACTIVE },
      }),
    );
    await this.redis.del(key);

    return { status: 'ok', tenant_id: payload.tenantId };
  }

  async updateMembership(
    tenantId: string,
    userId: string,
    dto: UpdateMembershipDto,
    _actor: Actor,
  ): Promise<MemberView> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const membership = await tx.userTenantRole.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { role: true },
      });
      if (!membership || membership.deletedAt) throw AppException.notFound('Membership not found');

      // Moving the last holder out of a protected role, or suspending them, would
      // lock the tenant out of that role (e.g. its last Admin). Guard by flag.
      const movingRole = !!dto.role_id && dto.role_id !== membership.roleId;
      const suspending = dto.status === MembershipStatus.SUSPENDED && membership.status === MembershipStatus.ACTIVE;
      if ((movingRole || suspending) && membership.role.isProtected) {
        await this.assertNotLastProtectedHolder(tx, tenantId, membership.role, membership.id);
      }

      if (movingRole) {
        const role = await tx.role.findFirst({ where: { id: dto.role_id, tenantId, deletedAt: null } });
        if (!role) throw AppException.validation('role_id does not reference a role in this tenant');
      }

      return tx.userTenantRole
        .update({
          where: { id: membership.id },
          data: {
            ...(dto.role_id ? { roleId: dto.role_id } : {}),
            ...(dto.status ? { status: dto.status } : {}),
          },
          include: { user: true, role: true },
        })
        .then(toMemberView);
    });
  }

  async removeMember(tenantId: string, userId: string, _actor: Actor): Promise<void> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const membership = await tx.userTenantRole.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { role: true },
      });
      if (!membership || membership.deletedAt) throw AppException.notFound('Membership not found');
      if (membership.role.isProtected) {
        await this.assertNotLastProtectedHolder(tx, tenantId, membership.role, membership.id);
      }
      await tx.userTenantRole.update({ where: { id: membership.id }, data: { deletedAt: new Date() } });
    });

    // Revoking access should end their active sessions for this tenant.
    await this.revokeTenantSessions(userId, tenantId);
  }

  // --- Internals -------------------------------------------------------------
  /**
   * Enforce that a protected role keeps at least one active holder. Counts OTHER
   * members holding the same protected role; blocks the change if it would drop
   * to zero. Generic over role name — driven by the `isProtected` flag.
   */
  private async assertNotLastProtectedHolder(
    tx: Tx,
    tenantId: string,
    role: { id: string; name: string },
    excludingMembershipId: string,
  ): Promise<void> {
    const holders = await tx.userTenantRole.count({
      where: {
        tenantId,
        deletedAt: null,
        status: MembershipStatus.ACTIVE,
        roleId: role.id,
        id: { not: excludingMembershipId },
      },
    });
    if (holders === 0) {
      throw AppException.conflict('last_admin', `A tenant must always have at least one "${role.name}"`);
    }
  }

  private async revokeTenantSessions(userId: string, tenantId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private inviteKey(rawToken: string): string {
    return `invite:${this.tokenHash.hashRefreshToken(rawToken)}`;
  }
}

function toMemberView(m: {
  id: string;
  userId: string;
  roleId: string;
  type: MembershipType;
  status: MembershipStatus;
  createdAt: Date;
  user: { email: string; name: string | null };
  role: { name: string };
}): MemberView {
  return {
    membership_id: m.id,
    user_id: m.userId,
    email: m.user.email,
    name: m.user.name,
    role_id: m.roleId,
    role: m.role.name,
    type: m.type,
    status: m.status,
    created_at: m.createdAt,
  };
}
