import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Reads and clears a single user's notification rows. Separate from NotificationsService, which
 * only ever writes them — the bell has no reason to depend on the email/SMS clients.
 */
@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, userId: string, limit: number) {
    const scoped = this.prisma.forTenant(tenantId);
    // userId is always part of the filter, so forTenant's tenant scoping is a second fence
    // rather than the only one.
    const [items, unread] = await Promise.all([
      scoped.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 50),
        select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      scoped.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /** updateMany, not update: it filters on userId, so one user can't clear another's row. */
  async markRead(tenantId: string, userId: string, id: string) {
    const { count } = await this.prisma.forTenant(tenantId).notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async markAllRead(tenantId: string, userId: string) {
    const { count } = await this.prisma.forTenant(tenantId).notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  /** The caller's own email/WhatsApp opt-out. In-app delivery is not switchable. */
  async getPreferences(tenantId: string, userId: string) {
    const user = await this.prisma.forTenant(tenantId).user.findFirstOrThrow({
      where: { id: userId },
      select: { emailNotifications: true },
    });
    return user;
  }

  async setPreferences(tenantId: string, userId: string, emailNotifications: boolean) {
    await this.prisma.forTenant(tenantId).user.updateMany({ where: { id: userId }, data: { emailNotifications } });
    return { emailNotifications };
  }
}
