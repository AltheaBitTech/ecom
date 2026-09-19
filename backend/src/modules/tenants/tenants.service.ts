import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Onboarding is a single-step create for now (status PENDING_VERIFICATION).
   * ponytail: the full onboarding state machine (document review, admin approval
   * queue, revision requests) is real scope from the spec but has no consumer yet
   * — add it when there's an admin approval UI to drive it, not before.
   */
  async create(name: string, taxInfo?: { gstin?: string; legalName?: string; pan?: string }) {
    const base = slugify(name);
    if (!base) throw new ConflictException('Business name must contain at least one letter or number');

    // Slugs are globally unique across tenants; retry with a numeric suffix on collision.
    for (let attempt = 0; attempt < 20; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt}`;
      const existing = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!existing) {
        return this.prisma.tenant.create({
          data: { name, slug, status: 'PENDING_VERIFICATION', ...taxInfo },
        });
      }
    }
    throw new ConflictException('Could not generate a unique slug for this business name');
  }

  findById(id: string) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  updateTaxInfo(
    tenantId: string,
    taxInfo: { name?: string; gstin?: string; legalName?: string; pan?: string; billingAddress?: Record<string, unknown>; logoUrl?: string; state?: string },
  ) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { ...taxInfo, billingAddress: taxInfo.billingAddress as Prisma.InputJsonValue | undefined },
    });
  }
}
