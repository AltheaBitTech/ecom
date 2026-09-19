import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { AuditService } from '../../common/auth/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CloneRoleDto } from './dto/clone-role.dto';
import { PERMISSIONS } from './permissions.catalog';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'List roles for the caller\'s tenant', description: `Requires ${PERMISSIONS.ROLES_VIEW}` })
  list(@CurrentUser() user: AuthContext) {
    return this.roles.list(user.tenantId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Create a custom role',
    description: `Requires ${PERMISSIONS.ROLES_MANAGE}. Permissions must be a subset of the caller's own.`,
  })
  async create(@CurrentUser() user: AuthContext, @Body() dto: CreateRoleDto) {
    const role = await this.roles.create(user.tenantId, user.permissions, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'role.create',
      resourceType: 'Role',
      resourceId: role.id,
      newValue: { name: role.name, permissions: role.permissions },
    });
    return role;
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Update a custom role',
    description: `Requires ${PERMISSIONS.ROLES_MANAGE}. Blocked for system roles. Permissions must be a subset of the caller's own.`,
  })
  async update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.roles.update(user.tenantId, id, user.permissions, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'role.update',
      resourceType: 'Role',
      resourceId: role.id,
      newValue: { name: role.name, permissions: role.permissions },
    });
    return role;
  }

  @Post(':id/clone')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Clone a role (system or custom) into a new custom role',
    description: `Requires ${PERMISSIONS.ROLES_MANAGE}. The caller must still hold every permission being cloned.`,
  })
  async clone(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: CloneRoleDto) {
    const role = await this.roles.clone(user.tenantId, id, user.permissions, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'role.clone',
      resourceType: 'Role',
      resourceId: role.id,
      newValue: { name: role.name, permissions: role.permissions },
    });
    return role;
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Archive (soft-delete) a custom role',
    description: `Requires ${PERMISSIONS.ROLES_MANAGE}. Blocked for system roles or roles with assigned users.`,
  })
  async archive(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    await this.roles.archive(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'role.archive',
      resourceType: 'Role',
      resourceId: id,
    });
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Delete a custom role',
    description: `Requires ${PERMISSIONS.ROLES_MANAGE}. Blocked for system roles or roles with assigned users.`,
  })
  async remove(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    await this.roles.delete(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'role.delete',
      resourceType: 'Role',
      resourceId: id,
    });
    return { success: true };
  }
}
