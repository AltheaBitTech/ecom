import { Body, Controller, Get, NotFoundException, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { TenantsService } from '../tenants/tenants.service';
import { SetPayoutVpaDto } from './dto/set-payout-vpa.dto';
import { ReferralsService } from './referrals.service';

@ApiTags('referrals')
@ApiBearerAuth('access-token')
@Controller('referrals')
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly tenants: TenantsService,
  ) {}

  @Post('code')
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  @ApiOperation({
    summary: "Issue this tenant's referral code",
    description: `Requires ${PERMISSIONS.REFERRALS_MANAGE}. Idempotent — returns the existing code if one already exists.`,
  })
  async issueCode(@CurrentUser() user: AuthContext) {
    const tenant = await this.tenants.findById(user.tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.referrals.issueCode(user.tenantId, tenant.slug);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.REFERRALS_VIEW)
  @ApiOperation({ summary: "This tenant's referral code, referrals, and earned commissions", description: `Requires ${PERMISSIONS.REFERRALS_VIEW}` })
  getMine(@CurrentUser() user: AuthContext) {
    return this.referrals.getMine(user.tenantId);
  }

  @Patch('payout-vpa')
  @RequirePermissions(PERMISSIONS.REFERRALS_MANAGE)
  @ApiOperation({
    summary: 'Set (or clear) the UPI VPA commission payouts are sent to',
    description: `Requires ${PERMISSIONS.REFERRALS_MANAGE}. Optional — commissions can still be settled manually without one.`,
  })
  setPayoutVpa(@CurrentUser() user: AuthContext, @Body() dto: SetPayoutVpaDto) {
    return this.referrals.setPayoutVpa(user.tenantId, dto.payoutVpa ?? null);
  }
}
