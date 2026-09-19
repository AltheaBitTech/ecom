import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/auth/audit.service';
import { Public } from '../../common/auth/public.decorator';
import { CurrentPlatformAdmin } from './current-platform-admin.decorator';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthGuard } from './platform-auth.guard';
import type { PlatformAuthContext } from './platform-request-context';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platform: PlatformService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Platform admin login', description: 'Cross-tenant super-admin — not a tenant User.' })
  login(@Body() dto: PlatformLoginDto) {
    return this.platform.login(dto);
  }
}

// @Public() bypasses the tenant JwtAuthGuard/PermissionsGuard globally; PlatformAuthGuard
// runs its own, separate check for every route below instead.
@ApiTags('platform')
@ApiBearerAuth('access-token')
@Controller('platform/tenants')
@Public()
@UseGuards(PlatformAuthGuard)
export class PlatformTenantsController {
  constructor(
    private readonly platform: PlatformService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tenants, optionally filtered by status' })
  list(@Query('status') status?: string) {
    return this.platform.listTenants(status);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a tenant under review, activating its workspace' })
  async approve(@CurrentPlatformAdmin() admin: PlatformAuthContext, @Param('id') id: string) {
    const tenant = await this.platform.approve(id);
    await this.logAction(admin, 'platform.tenant.approve', id);
    return tenant;
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a tenant under review' })
  async reject(@CurrentPlatformAdmin() admin: PlatformAuthContext, @Param('id') id: string) {
    const tenant = await this.platform.reject(id);
    await this.logAction(admin, 'platform.tenant.reject', id);
    return tenant;
  }

  @Post(':id/request-revision')
  @ApiOperation({ summary: 'Send a tenant under review back for revisions' })
  async requestRevision(@CurrentPlatformAdmin() admin: PlatformAuthContext, @Param('id') id: string) {
    const tenant = await this.platform.requestRevision(id);
    await this.logAction(admin, 'platform.tenant.request_revision', id);
    return tenant;
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend an active tenant' })
  async suspend(@CurrentPlatformAdmin() admin: PlatformAuthContext, @Param('id') id: string) {
    const tenant = await this.platform.suspend(id);
    await this.logAction(admin, 'platform.tenant.suspend', id);
    return tenant;
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended tenant' })
  async reactivate(@CurrentPlatformAdmin() admin: PlatformAuthContext, @Param('id') id: string) {
    const tenant = await this.platform.reactivate(id);
    await this.logAction(admin, 'platform.tenant.reactivate', id);
    return tenant;
  }

  private logAction(admin: PlatformAuthContext, action: string, tenantId: string) {
    return this.audit.log({ tenantId, actorId: admin.adminId, actorEmail: admin.email, action, resourceType: 'Tenant', resourceId: tenantId });
  }
}

@ApiTags('platform')
@ApiBearerAuth('access-token')
@Controller('platform/analytics')
@Public()
@UseGuards(PlatformAuthGuard)
export class PlatformAnalyticsController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Cross-tenant stats: tenant counts by status, MRR, GMV, order count, 30-day signups' })
  overview() {
    return this.platform.analyticsOverview();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Per-tenant usage table: orders, GMV, subscription plan/status' })
  tenants(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.platform.analyticsTenants(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }
}
