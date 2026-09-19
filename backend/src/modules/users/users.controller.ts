import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  @ApiOperation({ summary: 'List users for the caller\'s tenant', description: `Requires ${PERMISSIONS.USERS_VIEW}` })
  list(@CurrentUser() user: AuthContext) {
    return this.users.list(user.tenantId);
  }

  @Post(':id/suspend')
  @RequirePermissions(PERMISSIONS.USERS_SUSPEND)
  @ApiOperation({
    summary: 'Suspend a user',
    description: `Requires ${PERMISSIONS.USERS_SUSPEND}. Blocked if it would remove the last active Tenant Owner.`,
  })
  async suspend(@CurrentUser() actor: AuthContext, @Param('id') id: string) {
    const updated = await this.users.suspend(actor.tenantId, id);
    await this.audit.log({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      actorEmail: actor.email,
      action: 'user.suspend',
      resourceType: 'User',
      resourceId: id,
    });
    return updated;
  }
}
