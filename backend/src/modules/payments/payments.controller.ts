import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Auth, CurrentPrincipal, OptionalAuth, Public, RequirePermission } from '../../common/auth/decorators';
import { isStaff, type Principal } from '../../common/auth/principal';
import { AppException } from '../../common/errors/app-exception';
import { NoEnvelope } from '../../common/http/response.interceptor';

import { UpsertPaymentAccountDto, VerifyPaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

/**
 * Storefront payment flow. Pay/verify are optional-auth (a shopper's token
 * attributes the order; a guest proves ownership with the order's email). The
 * webhook is public and signature-verified — the gateway has no token.
 */
@ApiTags('storefront-payments')
@Controller('storefront/:tenantId')
export class StorefrontPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Create a gateway intent to pay a PENDING order. */
  @Post('orders/:id/pay')
  @OptionalAuth('customer')
  @HttpCode(200)
  pay(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal | undefined,
    @Query('email') email?: string,
  ) {
    return this.payments.createIntent(tenantId, id, principal, email);
  }

  /** Confirm a completed payment; on success the order becomes PAID. */
  @Post('orders/:id/pay/verify')
  @OptionalAuth('customer')
  @HttpCode(200)
  verify(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
    @CurrentPrincipal() principal: Principal | undefined,
    @Query('email') email?: string,
  ) {
    return this.payments.verify(tenantId, id, dto, principal, email);
  }

  /**
   * Gateway webhook. Requires the raw request body for signature verification, so
   * the response bypasses the envelope and always returns 200 once accepted.
   */
  @Post('payments/webhook')
  @Public()
  @NoEnvelope()
  @HttpCode(200)
  webhook(
    @Param('tenantId') tenantId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw AppException.validation('A raw request body is required for the webhook.');
    }
    return this.payments.handleWebhook(tenantId, raw, signature);
  }
}

/** Admin: connect a payment gateway. Gated by store_settings permissions. */
@ApiTags('payments-admin')
@Controller('tenants/:tenantId/payment-account')
@Auth('staff', 'internal')
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('store_settings:read')
  get(@Param('tenantId') tenantId: string) {
    return this.payments.getAccount(tenantId);
  }

  @Put()
  @RequirePermission('store_settings:write')
  upsert(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertPaymentAccountDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    const actor = isStaff(principal) ? principal.userId : 'internal';
    return this.payments.upsertAccount(tenantId, dto, actor);
  }
}
