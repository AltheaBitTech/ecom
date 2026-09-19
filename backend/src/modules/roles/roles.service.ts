import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from './permissions.catalog';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { CloneRoleDto } from './dto/clone-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called once, right after a tenant is created. */
  async seedSystemRoles(tenantId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    await scoped.role.createMany({
      data: Object.entries(SYSTEM_ROLES).map(([name, permissions]) => ({
        tenantId,
        name,
        isSystem: true,
        permissions,
      })),
    });
  }

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId).role.findMany({ where: { archivedAt: null }, orderBy: { createdAt: 'asc' } });
  }

  /** Checks a permission set against a catalog + escalation boundary. Shared by create/update/clone. */
  private assertGrantable(permissions: string[], actorPermissions: string[]) {
    const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission(s): ${unknown.join(', ')}`);
    }
    const grantedByActor = new Set(actorPermissions);
    const escalates = permissions.filter((p) => !grantedByActor.has(p));
    if (escalates.length > 0) {
      throw new ForbiddenException(`Cannot grant permission(s) you do not hold: ${escalates.join(', ')}`);
    }
  }

  async create(tenantId: string, creatorPermissions: string[], dto: CreateRoleDto) {
    // A custom role can never exceed the permission boundary of the user creating it.
    this.assertGrantable(dto.permissions, creatorPermissions);

    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.role.findFirst({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A role with this name already exists');

    return scoped.role.create({ data: { tenantId, name: dto.name, isSystem: false, permissions: dto.permissions } });
  }

  async update(tenantId: string, roleId: string, actorPermissions: string[], dto: UpdateRoleDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const role = await scoped.role.findFirst({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('System roles cannot be edited');

    if (dto.permissions) this.assertGrantable(dto.permissions, actorPermissions);

    if (dto.name && dto.name !== role.name) {
      const existing = await scoped.role.findFirst({ where: { name: dto.name } });
      if (existing) throw new ConflictException('A role with this name already exists');
    }

    return scoped.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
    });
  }

  async clone(tenantId: string, roleId: string, actorPermissions: string[], dto: CloneRoleDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const source = await scoped.role.findFirst({ where: { id: roleId } });
    if (!source) throw new NotFoundException('Role not found');

    // The actor must still hold every permission being cloned, even from a system role.
    this.assertGrantable(source.permissions, actorPermissions);

    const existing = await scoped.role.findFirst({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A role with this name already exists');

    return scoped.role.create({
      data: { tenantId, name: dto.name, isSystem: false, permissions: source.permissions },
    });
  }

  async archive(tenantId: string, roleId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const role = await scoped.role.findFirst({ where: { id: roleId }, include: { users: { include: { user: true } } } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('System roles cannot be archived');
    if (role.users.length > 0) {
      const names = role.users.map((ur: { user: { email: string } }) => ur.user.email).join(', ');
      throw new ConflictException(`Reassign ${role.users.length} user(s) before archiving this role: ${names}`);
    }
    await scoped.role.update({ where: { id: roleId }, data: { archivedAt: new Date() } });
  }

  async delete(tenantId: string, roleId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const role = await scoped.role.findFirst({ where: { id: roleId }, include: { users: true } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    if (role.users.length > 0) {
      throw new ConflictException('Reassign users before deleting this role');
    }
    await scoped.role.delete({ where: { id: roleId } });
  }
}
