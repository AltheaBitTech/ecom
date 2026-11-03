import { Module } from '@nestjs/common';

import { FlashSalesAdminController, FlashSalesStorefrontController } from './flash-sales.controller';
import { FlashSalesService } from './flash-sales.service';

@Module({
  controllers: [FlashSalesAdminController, FlashSalesStorefrontController],
  providers: [FlashSalesService],
})
export class PromotionsModule {}
