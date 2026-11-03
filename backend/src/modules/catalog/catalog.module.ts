import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';

import { AttributeValidatorService } from './attribute-validator.service';
import { CatalogAdminController, StorefrontCatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';

@Module({
  imports: [BillingModule],
  controllers: [CatalogAdminController, StorefrontCatalogController],
  providers: [ProductsService, CategoriesService, AttributeValidatorService],
  // AttributeValidatorService is reused by TenantsModule (schema validation).
  exports: [AttributeValidatorService],
})
export class CatalogModule {}
