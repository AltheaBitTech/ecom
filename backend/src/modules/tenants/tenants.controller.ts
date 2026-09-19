import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { UpdateTenantTaxInfoDto } from './dto/update-tenant-tax-info.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth('access-token')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Patch('me/tax-info')
  @RequirePermissions(PERMISSIONS.TENANT_SETTINGS_UPDATE)
  @ApiOperation({
    summary: 'Update the caller\'s tenant GST/tax details',
    description: `Requires ${PERMISSIONS.TENANT_SETTINGS_UPDATE}. All fields optional — a tenant can complete tax registration after signup.`,
  })
  updateTaxInfo(@CurrentUser() user: AuthContext, @Body() dto: UpdateTenantTaxInfoDto) {
    return this.tenants.updateTaxInfo(user.tenantId, dto);
  }
}
