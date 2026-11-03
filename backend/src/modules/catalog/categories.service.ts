import { Injectable } from '@nestjs/common';
import { Prisma, type Category } from '@prisma/client';

import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';

import type { CreateCategoryDto, UpdateCategoryDto } from './dto/catalog.dto';

/** Tenant-defined category tree. Purely organisational — no category-specific
 *  behaviour is attached to a category anywhere in the system. */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCategoryDto) {
    const category = await this.prisma.forTenant(tenantId, async (tx) => {
      await this.validateParent(tx, dto.parent_id);
      try {
        return await tx.category.create({
          data: {
            tenantId,
            name: dto.name,
            slug: dto.slug,
            parentId: dto.parent_id,
            position: dto.position ?? 0,
            description: dto.description?.trim() || null,
            imageUrl: dto.image_url || null,
            isFeatured: dto.is_featured ?? false,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw AppException.conflict('slug_taken', 'A category with that slug already exists');
        }
        throw err;
      }
    });
    return this.toView(category);
  }

  async list(tenantId: string) {
    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.category.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
    );
    return rows.map((c) => this.toView(c));
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.category.findFirst({ where: { id } });
      if (!existing) throw AppException.notFound('Category not found');
      return tx.category.update({
        where: { id },
        data: {
          name: dto.name,
          position: dto.position,
          description: dto.description === undefined ? undefined : dto.description?.trim() || null,
          imageUrl: dto.image_url,
          isFeatured: dto.is_featured,
        },
      });
    });
    return this.toView(category);
  }

  async remove(tenantId: string, id: string): Promise<{ id: string; deleted: true }> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.category.findFirst({ where: { id } });
      if (!existing) throw AppException.notFound('Category not found');
      await tx.category.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  private toView(c: Category) {
    return {
      id: c.id,
      tenant_id: c.tenantId,
      name: c.name,
      slug: c.slug,
      parent_id: c.parentId,
      position: c.position,
      description: c.description,
      image_url: c.imageUrl,
      is_featured: c.isFeatured,
    };
  }

  private async validateParent(tx: Prisma.TransactionClient, parentId: string | undefined): Promise<void> {
    if (!parentId) return;
    const parent = await tx.category.findFirst({ where: { id: parentId } });
    if (!parent) throw AppException.validation('Choose a parent category from this store.');
  }
}
