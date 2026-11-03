import { Injectable } from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';

import { AppException } from '../../common/errors/app-exception';
import { buildKeysetPage, decodeKeyset, type Keyset, type Page } from '../../common/http/pagination';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

import { AttributeValidatorService } from './attribute-validator.service';
import {
  ProductSort,
  type CreateProductDto,
  type ListProductsQueryDto,
  type UpdateProductDto,
} from './dto/catalog.dto';

/**
 * Maps each sort option to the ordering column, direction, and the keyset value
 * extracted from a row. `id` is always the final tiebreaker so pagination is
 * total-ordered and stable.
 */
const SORTS: Record<
  ProductSort,
  { field: 'createdAt' | 'priceCents' | 'name'; dir: 'asc' | 'desc'; keyOf: (p: Product) => string | number }
> = {
  [ProductSort.NEWEST]: { field: 'createdAt', dir: 'desc', keyOf: (p) => p.createdAt.toISOString() },
  [ProductSort.OLDEST]: { field: 'createdAt', dir: 'asc', keyOf: (p) => p.createdAt.toISOString() },
  [ProductSort.PRICE_ASC]: { field: 'priceCents', dir: 'asc', keyOf: (p) => p.priceCents },
  [ProductSort.PRICE_DESC]: { field: 'priceCents', dir: 'desc', keyOf: (p) => p.priceCents },
  [ProductSort.NAME_ASC]: { field: 'name', dir: 'asc', keyOf: (p) => p.name },
  [ProductSort.NAME_DESC]: { field: 'name', dir: 'desc', keyOf: (p) => p.name },
};

export function validateMerchandising(
  priceCents: number,
  compareAtPriceCents: number | null | undefined,
): void {
  if (compareAtPriceCents !== null && compareAtPriceCents !== undefined && compareAtPriceCents <= priceCents) {
    throw AppException.validation('Compare-at price must be greater than the selling price.');
  }
}

export function validatePublication(
  status: Product['status'],
  categoryId: string | null | undefined,
  images: unknown[],
): void {
  if (status !== 'ACTIVE') return;
  if (!categoryId) throw AppException.validation('Published products must have a category.');
  if (images.length === 0) throw AppException.validation('Published products must have at least one image.');
}

/**
 * Product catalog. Two invariants make this category-agnostic and plan-aware:
 *   - custom_attributes are validated against the tenant's own JSON Schema on
 *     every write (no category-specific code here);
 *   - the product count is checked against the tenant's plan limit before a
 *     create, via the single BillingService — never a plan-name conditional.
 *
 * All access is under forTenant, so RLS is the backstop even if a filter is
 * ever wrong.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attributes: AttributeValidatorService,
    private readonly billing: BillingService,
  ) {}

  async create(tenantId: string, dto: CreateProductDto) {
    // Resolve the plan limit up front (its own transaction) so we never open a
    // nested transaction inside forTenant below.
    const productLimit = await this.billing.limitFor(tenantId, 'products');

    const product = await this.prisma.forTenant(tenantId, async (tx) => {
      const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
      this.attributes.validate(settings?.productAttributeSchema, dto.custom_attributes ?? {});
      await this.validateCategory(tx, dto.category_id);
      validateMerchandising(dto.price_cents, dto.compare_at_price_cents);
      validatePublication(dto.status ?? 'DRAFT', dto.category_id, dto.images ?? []);

      if (productLimit !== -1) {
        const count = await tx.product.count({ where: { deletedAt: null } });
        if (count + 1 > productLimit) {
          throw AppException.limitExceeded(
            `Your plan allows ${productLimit} products; you have ${count}. Upgrade to add more.`,
          );
        }
      }

      try {
        return await tx.product.create({
          data: {
            tenantId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            priceCents: dto.price_cents,
            currency: dto.currency ?? 'INR',
            stock: dto.stock ?? 0,
            compareAtPriceCents: dto.compare_at_price_cents,
            isFeatured: dto.is_featured ?? false,
            isBestseller: dto.is_bestseller ?? false,
            badge: dto.badge?.trim() || null,
            images: (dto.images ?? []) as Prisma.InputJsonValue,
            customAttributes: (dto.custom_attributes ?? {}) as Prisma.InputJsonValue,
            categoryId: dto.category_id,
            status: dto.status ?? 'DRAFT',
          },
        });
      } catch (err) {
        throw this.mapWriteError(err);
      }
    });

    return this.toView(product);
  }

  async list(tenantId: string, query: ListProductsQueryDto): Promise<Page<unknown>> {
    const sort = SORTS[query.sort ?? ProductSort.NEWEST];
    const keyset = decodeKeyset(query.cursor);

    // Filters combine with AND; the keyset "seek" predicate is a separate AND term.
    const filters: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category_id ? { categoryId: query.category_id } : {}),
      ...(query.in_stock ? { stock: { gt: 0 } } : {}),
      ...(query.min_price !== undefined || query.max_price !== undefined
        ? {
            priceCents: {
              ...(query.min_price !== undefined ? { gte: query.min_price } : {}),
              ...(query.max_price !== undefined ? { lte: query.max_price } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const where: Prisma.ProductWhereInput = keyset
      ? { AND: [filters, this.seek(sort, keyset)] }
      : filters;

    const rows = await this.prisma.forTenant(tenantId, (tx) =>
      tx.product.findMany({
        where,
        // Sort column then id — a total order the keyset cursor can resume from.
        orderBy: [{ [sort.field]: sort.dir }, { id: sort.dir }],
        take: query.limit + 1,
      }),
    );
    return buildKeysetPage(rows, query.limit, sort.keyOf, (p) => this.toView(p));
  }

  /** Public storefront listing: only ACTIVE products. */
  async listPublished(tenantId: string, query: ListProductsQueryDto): Promise<Page<unknown>> {
    return this.list(tenantId, { ...query, status: 'ACTIVE' as Product['status'] });
  }

  /**
   * The keyset "seek" predicate: rows strictly after the cursor in the sort
   * order. For ascending: (col > v) OR (col = v AND id > id). Descending flips
   * the comparators. This is the row-value comparison expressed for Prisma.
   */
  private seek(sort: (typeof SORTS)[ProductSort], keyset: Keyset): Prisma.ProductWhereInput {
    // createdAt comes back from the cursor as an ISO string; the column is a Date.
    const value = sort.field === 'createdAt' ? new Date(keyset.v as string) : keyset.v;
    const cmp = sort.dir === 'asc' ? 'gt' : 'lt';
    return {
      OR: [
        { [sort.field]: { [cmp]: value } },
        { AND: [{ [sort.field]: value }, { id: { [cmp]: keyset.id } }] },
      ],
    };
  }

  async get(tenantId: string, id: string) {
    const product = await this.prisma.forTenant(tenantId, (tx) =>
      tx.product.findFirst({ where: { id, deletedAt: null } }),
    );
    if (!product) throw AppException.notFound('Product not found');
    return this.toView(product);
  }

  /** Public storefront fetch: only an ACTIVE product is visible to shoppers. */
  async getPublished(tenantId: string, id: string) {
    const product = await this.prisma.forTenant(tenantId, (tx) =>
      tx.product.findFirst({ where: { id, deletedAt: null, status: 'ACTIVE' } }),
    );
    if (!product) throw AppException.notFound('Product not found');
    return this.toView(product);
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw AppException.notFound('Product not found');

      if (dto.custom_attributes !== undefined) {
        const settings = await tx.tenantSettings.findUnique({ where: { tenantId } });
        this.attributes.validate(settings?.productAttributeSchema, dto.custom_attributes);
      }

      if (dto.category_id !== undefined) await this.validateCategory(tx, dto.category_id);
      const nextPrice = dto.price_cents ?? existing.priceCents;
      const nextCompareAt = dto.compare_at_price_cents === undefined
        ? existing.compareAtPriceCents
        : dto.compare_at_price_cents;
      validateMerchandising(nextPrice, nextCompareAt);
      validatePublication(
        dto.status ?? existing.status,
        dto.category_id === undefined ? existing.categoryId : dto.category_id,
        dto.images === undefined ? (existing.images as string[]) : dto.images,
      );

      try {
        return await tx.product.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            priceCents: dto.price_cents,
            stock: dto.stock,
            compareAtPriceCents: dto.compare_at_price_cents,
            isFeatured: dto.is_featured,
            isBestseller: dto.is_bestseller,
            badge: dto.badge === undefined ? undefined : dto.badge?.trim() || null,
            status: dto.status,
            categoryId: dto.category_id,
            ...(dto.images !== undefined ? { images: dto.images as Prisma.InputJsonValue } : {}),
            ...(dto.custom_attributes !== undefined
              ? { customAttributes: dto.custom_attributes as Prisma.InputJsonValue }
              : {}),
          },
        });
      } catch (err) {
        throw this.mapWriteError(err);
      }
    });
    return this.toView(product);
  }

  async remove(tenantId: string, id: string): Promise<{ id: string; deleted: true }> {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw AppException.notFound('Product not found');
      await tx.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    });
    return { id, deleted: true };
  }

  private mapWriteError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return AppException.conflict('slug_taken', 'A product with that slug already exists in this store');
    }
    return err;
  }

  private async validateCategory(
    tx: Prisma.TransactionClient,
    categoryId: string | null | undefined,
  ): Promise<void> {
    if (!categoryId) return;
    const category = await tx.category.findFirst({ where: { id: categoryId } });
    if (!category) throw AppException.validation('Choose a category from this store.');
  }

  private toView(p: Product) {
    return {
      id: p.id,
      tenant_id: p.tenantId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: p.status,
      price_cents: p.priceCents,
      currency: p.currency,
      stock: p.stock,
      compare_at_price_cents: p.compareAtPriceCents,
      is_featured: p.isFeatured,
      is_bestseller: p.isBestseller,
      badge: p.badge,
      images: p.images ?? [],
      custom_attributes: p.customAttributes ?? {},
      category_id: p.categoryId,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }
}
