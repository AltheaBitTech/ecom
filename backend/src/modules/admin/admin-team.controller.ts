import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, CurrentPrincipal, RequirePermission } from '../../common/auth/decorators';
import { isStaff, type Principal } from '../../common/auth/principal';
import { CreateRoleDto, UpdateRoleDto } from '../rbac/dto/rbac.dto';
import { RbacService } from '../rbac/rbac.service';
import { InviteStaffDto, UpdateMembershipDto } from '../staff/dto/staff.dto';
import { StaffService, type Actor } from '../staff/staff.service';

import { AdminListQueryDto } from './dto/admin.dto';

/**
 * Team management (roles, staff, permission catalog) for a store's admins.
 *
 * These are ecom's OWN endpoints, served by the native RbacService/StaffService
 * and guarded by ecom's RBAC (`@RequirePermission` + the tenant-boundary check
 * on `:tenantId`). Every role/staff read and write runs under the tenant's RLS
 * context inside those services, so a staff member is confined to their own
 * tenant and their granted capabilities.
 */
@ApiTags('admin-team')
@Controller('tenants/:tenantId')
@Auth('staff', 'internal')
export class AdminTeamController {
  constructor(
    private readonly rbac: RbacService,
    private readonly staff: StaffService,
  ) {}

  @Get('permissions')
  @RequirePermission('staff:read')
  listPermissions() {
    // The permission catalog is global (not tenant-scoped); the tenant in the
    // route only scopes who is allowed to read it.
    return this.rbac.listPermissions();
  }

  // --- roles ----------------------------------------------------------------

  @Get('roles')
  @RequirePermission('staff:read')
  listRoles(@Param('tenantId') tenantId: string, @Query() query: AdminListQueryDto) {
    return this.rbac.listRoles(tenantId, query);
  }

  @Post('roles')
  @RequirePermission('staff:manage_roles')
  createRole(@Param('tenantId') tenantId: string, @Body() dto: CreateRoleDto) {
    return this.rbac.createRole(tenantId, dto);
  }

  @Patch('roles/:roleId')
  @RequirePermission('staff:manage_roles')
  updateRole(
    @Param('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(tenantId, roleId, dto);
  }

  @Delete('roles/:roleId')
  @RequirePermission('staff:manage_roles')
  @HttpCode(204)
  async deleteRole(
    @Param('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.rbac.deleteRole(tenantId, roleId);
  }

  // --- staff ----------------------------------------------------------------

  @Get('staff')
  @RequirePermission('staff:read')
  listStaff(@Param('tenantId') tenantId: string, @Query() query: AdminListQueryDto) {
    return this.staff.listMembers(tenantId, query);
  }

  @Post('staff/invite')
  @RequirePermission('staff:write')
  inviteStaff(
    @Param('tenantId') tenantId: string,
    @Body() dto: InviteStaffDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.staff.invite(tenantId, dto, actorOf(principal));
  }

  @Patch('staff/:userId')
  @RequirePermission('staff:manage_roles')
  updateMembership(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.staff.updateMembership(tenantId, userId, dto, actorOf(principal));
  }

  @Delete('staff/:userId')
  @RequirePermission('staff:write')
  @HttpCode(204)
  async removeStaff(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<void> {
    await this.staff.removeMember(tenantId, userId, actorOf(principal));
  }
}

/** The mutating actor — a staff user, or an internal (server-to-server) caller. */
function actorOf(principal: Principal): Actor {
  return { userId: isStaff(principal) ? principal.userId : 'internal' };
}
