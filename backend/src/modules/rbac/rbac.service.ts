import { Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app-exception';
import { buildPage, decodeCursor, type Page } from '../../common/http/pagination';
import { PrismaService, type Tx } from '../../common/prisma/prisma.service';

import { CreateRoleDto, UpdateRoleDto } from './dto/rbac.dto';

/** Pagination inputs shared by the list endpoints. */
export interface ListQuery {
  limit?: number;
  cursor?: string;
}

/** The shape every role read returns. Stable, snake_cased for the wire. */
export interface RoleView {
  id: string;
  tenant_id: string;
  name: string;
  is_system_role: boolean;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

/**
 * Role & permission management for a tenant. Roles are tenant-scoped rows guarded
 * by RLS; the permission *catalog* is a global table. Every mutation here also
 * (re)writes the role's permission set atomically.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a role's permission keys, scoped by RLS to the tenant. */
  async resolvePermissions(tenantId: string, roleId: string): Promise<string[]> {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.rolePermission.findMany({ where: { roleId }, include: { permission: true } }),
    );
    return rows.map((rp) => rp.permission.key);
  }

  /**
   * Clone the NULL-tenant system-role templates into concrete tenant-owned roles.
   * Called once when a tenant is provisioned. Runs entirely inside the tenant's
   * RLS context: templates are readable (policy allows tenant_id IS NULL) and the
   * new tenant rows satisfy the WITH CHECK clause. Returns the id of the tenant's
   * grant-on-provision (Admin) role so the founder can be granted it.
   */
  async cloneSystemRoles(tenantId: string, _createdBy?: string): Promise<{ grantOnProvisionRoleId: string }> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const templates = await tx.role.findMany({
        where: { tenantId: null, deletedAt: null },
        include: { rolePermissions: true },
      });

      let grantOnProvisionRoleId: string | null = null;
      for (const template of templates) {
        const role = await tx.role.create({
          data: {
            tenantId,
            name: template.name,
            isSystemRole: true,
            grantOnProvision: template.grantOnProvision,
            isProtected: template.isProtected,
          },
        });
        if (template.grantOnProvision) grantOnProvisionRoleId = role.id;
        if (template.rolePermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: template.rolePermissions.map((rp) => ({ roleId: role.id, permissionId: rp.permissionId })),
          });
        }
      }

      if (!grantOnProvisionRoleId) {
        throw AppException.validation('No grant-on-provision system role template found');
      }
      return { grantOnProvisionRoleId };
    });
  }

  async listRoles(tenantId: string, query: ListQuery): Promise<Page<RoleView>> {
    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.role.findMany({
        where: { tenantId, deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) },
        include: { rolePermissions: { include: { permission: true } } },
        orderBy: { id: 'asc' },
        take: limit + 1,
      }),
    );
    return buildPage(rows, limit, toRoleView) as Page<RoleView>;
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleView> {
    const role = await this.prisma.forTenant(tenantId, (tx) =>
      tx.role.findFirst({
        where: { id: roleId, tenantId, deletedAt: null },
        include: { rolePermissions: { include: { permission: true } } },
      }),
    );
    if (!role) throw AppException.notFound('Role not found');
    return toRoleView(role);
  }

  async createRole(tenantId: string, dto: CreateRoleDto): Promise<RoleView> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.role.findFirst({ where: { tenantId, name: dto.name, deletedAt: null } });
      if (existing) throw AppException.conflict('role_name_taken', `A role named "${dto.name}" already exists`);

      const permissionIds = await this.resolvePermissionIds(tx, dto.permissions);
      const role = await tx.role.create({
        data: {
          tenantId,
          name: dto.name,
          isSystemRole: false,
          rolePermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: { rolePermissions: { include: { permission: true } } },
      });
      return toRoleView(role);
    });
  }

  async updateRole(tenantId: string, roleId: string, dto: UpdateRoleDto): Promise<RoleView> {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } });
      if (!role) throw AppException.notFound('Role not found');
      if (role.isSystemRole && dto.name && dto.name !== role.name) {
        throw AppException.validation('System roles cannot be renamed');
      }

      if (dto.name && dto.name !== role.name) {
        const clash = await tx.role.findFirst({
          where: { tenantId, name: dto.name, deletedAt: null, id: { not: roleId } },
        });
        if (clash) throw AppException.conflict('role_name_taken', `A role named "${dto.name}" already exists`);
      }

      if (dto.permissions) {
        const permissionIds = await this.resolvePermissionIds(tx, dto.permissions);
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          });
        }
      }

      const updated = await tx.role.update({
        where: { id: roleId },
        data: { ...(dto.name ? { name: dto.name } : {}) },
        include: { rolePermissions: { include: { permission: true } } },
      });
      return toRoleView(updated);
    });
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } });
      if (!role) throw AppException.notFound('Role not found');
      if (role.isSystemRole) throw AppException.validation('System roles cannot be deleted');

      const inUse = await tx.userTenantRole.count({ where: { roleId, deletedAt: null } });
      if (inUse > 0) {
        throw AppException.conflict(
          'role_in_use',
          'Role is still assigned to members; reassign them before deleting',
        );
      }
      await tx.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    });
  }

  /** The global permission catalog (not tenant-scoped). */
  async listPermissions(): Promise<Array<{ key: string; description: string }>> {
    const rows = await this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
    return rows.map((p) => ({ key: p.key, description: p.description }));
  }

  /** Map permission keys to ids, rejecting unknown keys. */
  private async resolvePermissionIds(tx: Tx, keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const catalog = await tx.permission.findMany({ where: { key: { in: keys } } });
    const byKey = new Map(catalog.map((p) => [p.key, p.id]));
    const unknown = keys.filter((k) => !byKey.has(k));
    if (unknown.length > 0) {
      throw AppException.validation(`Unknown permission keys: ${unknown.join(', ')}`);
    }
    return keys.map((k) => byKey.get(k) as string);
  }
}

type RoleWithPermissions = {
  id: string;
  tenantId: string | null;
  name: string;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
  rolePermissions: Array<{ permission: { key: string } }>;
};

function toRoleView(role: RoleWithPermissions): RoleView {
  return {
    id: role.id,
    tenant_id: role.tenantId as string,
    name: role.name,
    is_system_role: role.isSystemRole,
    permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
    created_at: role.createdAt,
    updated_at: role.updatedAt,
  };
}
