import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CatalogModule } from '../catalog/catalog.module';
import { RbacModule } from '../rbac/rbac.module';

import {
  OnboardingController,
  PublicStoreController,
  StorefrontConfigController,
  TenantsController,
} from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [CatalogModule, BillingModule, AuthModule, RbacModule],
  controllers: [
    OnboardingController,
    TenantsController,
    StorefrontConfigController,
    PublicStoreController,
  ],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
