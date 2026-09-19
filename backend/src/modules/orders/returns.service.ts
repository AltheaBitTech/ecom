import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const RETURNABLE_STATUSES = new Set(['SHIPPED', 'FULFILLED']);

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Customer-facing: request a return against their own order (same email-ownership check as findForCustomer). */
  async request(orderId: string, email: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customer: { email: { equals: email, mode: 'insensitive' } } },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!RETURNABLE_STATUSES.has(order.status)) {
      throw new BadRequestException('Only shipped or fulfilled orders can be returned');
    }
    const request = await this.prisma.returnRequest.create({
      data: { tenantId: order.tenantId, orderId, reason },
    });
    void this.notifications.notifyReturnRequested(order.tenantId, order, reason);
    return request;
  }

  list(tenantId: string, orderId?: string) {
    const scoped = this.prisma.forTenant(tenantId);
    return scoped.returnRequest.findMany({
      where: orderId ? { orderId } : {},
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ponytail: REFUNDED just records the decision — it does not call Razorpay's refund API.
  // Admin issues the actual refund via the Razorpay dashboard, then marks it here. Upgrade:
  // wire payments.service's Razorpay client to POST /payments/:id/refund when that's needed.
  async resolve(tenantId: string, id: string, status: 'APPROVED' | 'REJECTED' | 'REFUNDED', refundCents?: number, adminNote?: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.returnRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Return request not found');
    if (existing.status !== 'REQUESTED' && existing.status !== 'APPROVED') {
      throw new ConflictException(`Return already ${existing.status.toLowerCase()}`);
    }
    const updated = await scoped.returnRequest.update({
      where: { id },
      data: { status, refundCents: refundCents ?? existing.refundCents, adminNote, resolvedAt: status === 'REJECTED' || status === 'REFUNDED' ? new Date() : null },
      include: { order: { include: { customer: true } } },
    });
    void this.notifications.notifyReturnResolved(updated.order, status, updated.refundCents, adminNote);
    return updated;
  }
}
