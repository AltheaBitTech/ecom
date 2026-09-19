import { BadRequestException, Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { BillingService, type BillingWebhookEvent } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly audit: AuditService,
  ) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List active subscription plans' })
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('subscription')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.BILLING_VIEW)
  @ApiOperation({ summary: "The caller's tenant subscription + payment history", description: `Requires ${PERMISSIONS.BILLING_VIEW}` })
  getSubscription(@CurrentUser() user: AuthContext) {
    return this.billing.getSubscription(user.tenantId);
  }

  @Post('subscribe')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @ApiOperation({ summary: 'Subscribe the tenant to a plan', description: `Requires ${PERMISSIONS.BILLING_MANAGE}` })
  async subscribe(@CurrentUser() user: AuthContext, @Body() dto: SubscribeDto) {
    const result = await this.billing.subscribe(user.tenantId, dto.planId);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'billing.subscribe',
      resourceType: 'Subscription',
      resourceId: result.subscription.id,
      newValue: { planId: dto.planId, razorpaySubscriptionId: result.razorpaySubscriptionId },
    });
    return result;
  }

  @Post('change-plan')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @ApiOperation({ summary: 'Change the tenant to a different plan', description: `Requires ${PERMISSIONS.BILLING_MANAGE}. Cancels the current Razorpay subscription and starts a new one.` })
  async changePlan(@CurrentUser() user: AuthContext, @Body() dto: SubscribeDto) {
    const result = await this.billing.changePlan(user.tenantId, dto.planId);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'billing.change_plan',
      resourceType: 'Subscription',
      resourceId: result.subscription.id,
      newValue: { planId: dto.planId, razorpaySubscriptionId: result.razorpaySubscriptionId },
    });
    return result;
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Razorpay subscription webhook receiver', description: 'Signature-verified; not part of the authenticated API.' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    if (!req.rawBody || !this.billing.verifySignature(req.rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    await this.billing.applyWebhookEvent(req.body as BillingWebhookEvent);
    return { received: true };
  }
}
