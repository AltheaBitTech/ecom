import { BadRequestException, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { PaymentsService, type RazorpayWebhookEvent } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  @Get('payments')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'List payments for the caller\'s tenant', description: `Requires ${PERMISSIONS.PAYMENTS_VIEW}` })
  list(@CurrentUser() user: AuthContext) {
    return this.payments.list(user.tenantId);
  }

  @Post('orders/:id/payment')
  @ApiBearerAuth('access-token')
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @ApiOperation({
    summary: 'Create a Razorpay payment order for an order',
    description: `Requires ${PERMISSIONS.ORDERS_MANAGE}. Returns the Razorpay order id + key id for the frontend checkout widget.`,
  })
  async createPayment(@CurrentUser() user: AuthContext, @Param('id') orderId: string) {
    const result = await this.payments.createPaymentForOrder(user.tenantId, orderId);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'payment.create',
      resourceType: 'Payment',
      resourceId: result.payment.id,
      newValue: { orderId, providerOrderId: result.razorpayOrderId },
    });
    return result;
  }

  @Post('payments/webhook')
  @Public()
  @ApiOperation({ summary: 'Razorpay webhook receiver', description: 'Signature-verified; not part of the authenticated API.' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    if (!req.rawBody || !this.payments.verifySignature(req.rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    await this.payments.applyWebhookEvent(req.body as RazorpayWebhookEvent);
    return { received: true };
  }
}
