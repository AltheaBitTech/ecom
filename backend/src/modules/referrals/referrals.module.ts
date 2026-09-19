import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PlatformReferralsController } from './platform-referrals.controller';
import { PayoutsService } from './payouts.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [TenantsModule, PlatformModule],
  controllers: [ReferralsController, PlatformReferralsController],
  providers: [ReferralsService, PayoutsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
