import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../../common/auth/decorators';

import { BillingService } from './billing.service';

/**
 * Read-only entitlement surface. The admin UI calls this to render plan-gated
 * features (it hides what the tenant can't use) — the same data the backend
 * enforces with, so UI and API never disagree.
 */
@ApiTags('billing')
@Controller('tenants/:tenantId/billing')
@Auth('staff', 'internal')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('entitlements')
  entitlements(@Param('tenantId') tenantId: string) {
    return this.billing.entitlements(tenantId);
  }
}
