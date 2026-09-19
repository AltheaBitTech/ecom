import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { PlatformAuthGuard } from '../platform/platform-auth.guard';
import { SetRateDto } from './dto/set-rate.dto';
import { ReferralsService } from './referrals.service';

// @Public() bypasses the tenant JwtAuthGuard/PermissionsGuard globally; PlatformAuthGuard
// runs its own, separate check for every route below instead — same pattern as
// PlatformTenantsController in modules/platform/platform.controller.ts.
@ApiTags('platform')
@ApiBearerAuth('access-token')
@Controller('platform/referrals')
@Public()
@UseGuards(PlatformAuthGuard)
export class PlatformReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Post(':commissionId/pay')
  @ApiOperation({ summary: 'Mark a referral commission as paid out' })
  payCommission(@Param('commissionId') commissionId: string) {
    return this.referrals.markCommissionPaid(commissionId);
  }

  @Patch('tenants/:tenantId/rate')
  @ApiOperation({ summary: "Set (or clear) a VIP commission rate override on a tenant's referral code" })
  setRate(@Param('tenantId') tenantId: string, @Body() dto: SetRateDto) {
    return this.referrals.setRate(tenantId, dto.commissionBps ?? null);
  }
}
