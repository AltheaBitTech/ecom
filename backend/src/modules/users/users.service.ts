import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const OWNER_ROLE_NAME = 'Tenant Owner';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId).user.findMany({
      select: { id: true, email: true, status: true, createdAt: true, roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async suspend(tenantId: string, userId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const user = await scoped.user.findFirst({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException('User not found');

    const isOwner = user.roles.some((ur) => ur.role.name === OWNER_ROLE_NAME);
    if (isOwner) {
      await this.assertNotLastActiveOwner(tenantId, userId);
    }

    return scoped.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
      select: { id: true, email: true, status: true },
    });
  }

  /** At least one active Tenant Owner must always exist for a tenant. */
  private async assertNotLastActiveOwner(tenantId: string, excludingUserId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const otherActiveOwners = await scoped.user.count({
      where: {
        id: { not: excludingUserId },
        status: 'ACTIVE',
        roles: { some: { role: { name: OWNER_ROLE_NAME } } },
      },
    });
    if (otherActiveOwners === 0) {
      throw new ConflictException('At least one active Tenant Owner must remain');
    }
  }
}
