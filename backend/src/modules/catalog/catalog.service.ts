import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { CreateVariantDto } from './dto/create-variant.dto';
import type { UpdateVariantDto } from './dto/update-variant.dto';
import type { ListProductsDto } from './dto/list-products.dto';

const PRODUCT_INCLUDE = {
  inventory: true,
  variants: { where: { archivedAt: null }, orderBy: { createdAt: 'asc' } },
} as const;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, includeArchived: boolean, query: ListProductsDto = {}) {
    const { category, search, status, sortBy = 'createdAt', sortDir = 'desc' } = query;
    const statusFilter: Prisma.ProductWhereInput =
      status === 'published'
        ? { publishedAt: { not: null }, archivedAt: null }
        : status === 'archived'
          ? { archivedAt: { not: null } }
          : status === 'draft'
            ? { publishedAt: null, archivedAt: null }
            : includeArchived
              ? {}
              : { archivedAt: null };
    const where: Prisma.ProductWhereInput = {
      ...statusFilter,
      ...(category ? { category } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
        : {}),
    };
    return this.prisma.forTenant(tenantId).product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { [sortBy]: sortDir },
    });
  }

  async findOne(tenantId: string, productId: string) {
    const product = await this.prisma
      .forTenant(tenantId)
      .product.findFirst({ where: { id: productId }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    if (dto.compareAtCents != null && dto.compareAtCents <= dto.priceCents) throw new BadRequestException('Original price must exceed selling price');
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.product.findFirst({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException('A product with this SKU already exists');

    // Every product gets a zeroed inventory row up front so callers never have to
    // handle a "product with no stock record yet" case (see inventory.service.ts).
    return scoped.product.create({
      data: {
        tenantId,
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        imageUrl: dto.imageUrl,
        category: dto.category,
        featured: dto.featured,
        compareAtCents: dto.compareAtCents,
        images: dto.images,
        videos: dto.videos,
        labels: dto.labels,
        gstRateBps: dto.gstRateBps,
        hsnCode: dto.hsnCode,
        inventory: { create: { tenantId, quantityOnHand: 0, reorderThreshold: 0 } },
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(tenantId: string, productId: string, dto: UpdateProductDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.product.findFirst({ where: { id: productId } });
    if (!existing) throw new NotFoundException('Product not found');
    const original = dto.compareAtCents === undefined ? existing.compareAtCents : dto.compareAtCents;
    if (original != null && original <= (dto.priceCents ?? existing.priceCents)) throw new BadRequestException('Original price must exceed selling price');
    return scoped.product.update({ where: { id: productId }, data: dto, include: PRODUCT_INCLUDE });
  }

  async archive(tenantId: string, productId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.product.findFirst({ where: { id: productId } });
    if (!existing) throw new NotFoundException('Product not found');
    if (existing.archivedAt) throw new ConflictException('Product is already archived');
    return scoped.product.update({ where: { id: productId }, data: { archivedAt: new Date() } });
  }

  /** Minimal publishing checklist from the product blueprint: sellable fields must be set. */
  async publish(tenantId: string, productId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.product.findFirst({ where: { id: productId } });
    if (!existing) throw new NotFoundException('Product not found');
    if (existing.archivedAt) throw new ConflictException('Archived products cannot be published');
    if (existing.publishedAt) return existing;

    const missing: string[] = [];
    if (!existing.name?.trim()) missing.push('name');
    if (!existing.sku?.trim()) missing.push('sku');
    if (!(existing.priceCents > 0)) missing.push('priceCents');
    if (missing.length > 0) {
      throw new BadRequestException(`Cannot publish: missing required field(s): ${missing.join(', ')}`);
    }

    return scoped.product.update({ where: { id: productId }, data: { publishedAt: new Date() } });
  }

  async unpublish(tenantId: string, productId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.product.findFirst({ where: { id: productId } });
    if (!existing) throw new NotFoundException('Product not found');
    if (existing.archivedAt) throw new ConflictException('Archived products cannot be unpublished');
    if (!existing.publishedAt) return existing;
    return scoped.product.update({ where: { id: productId }, data: { publishedAt: null } });
  }

  // ---------------------------------------------------------------------
  // Variants — a product's sellable options (see ProductVariant in schema.prisma).
  // Dynamic label, not a fixed weight/size enum: "Half"/"Full", "70 Gram"/"1 Kg", anything.
  // ---------------------------------------------------------------------

  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const product = await scoped.product.findFirst({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (dto.compareAtCents != null && dto.compareAtCents <= dto.priceCents) throw new BadRequestException('Original price must exceed selling price');
    return scoped.productVariant.create({
      data: { tenantId, productId, label: dto.label, priceCents: dto.priceCents, compareAtCents: dto.compareAtCents },
    });
  }

  async updateVariant(tenantId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!existing) throw new NotFoundException('Variant not found');
    const original = dto.compareAtCents === undefined ? existing.compareAtCents : dto.compareAtCents;
    if (original != null && original <= (dto.priceCents ?? existing.priceCents)) throw new BadRequestException('Original price must exceed selling price');
    return scoped.productVariant.update({ where: { id: variantId }, data: dto });
  }

  async archiveVariant(tenantId: string, productId: string, variantId: string) {
    const scoped = this.prisma.forTenant(tenantId);
    const existing = await scoped.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!existing) throw new NotFoundException('Variant not found');
    return scoped.productVariant.update({ where: { id: variantId }, data: { archivedAt: new Date() } });
  }

  async exportCsv(tenantId: string): Promise<string> {
    const scoped = this.prisma.forTenant(tenantId);
    const products = await scoped.product.findMany({ orderBy: { createdAt: 'asc' } });
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['sku', 'name', 'description', 'priceCents', 'category', 'gstRateBps', 'hsnCode'];
    const rows = products.map((p) => [p.sku, p.name, p.description ?? '', String(p.priceCents), p.category, String(p.gstRateBps), p.hsnCode ?? '']);
    return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  }

  /**
   * Bulk create/update by SKU. Minimal CSV parser (no quoted-comma support) — good enough for
   * the export format above round-tripping through a spreadsheet. Upgrade to a real CSV lib
   * (papaparse) if sellers start hand-editing files with commas in descriptions.
   */
  async importCsv(tenantId: string, csv: string): Promise<{ created: number; updated: number; errors: string[] }> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new BadRequestException('CSV has no data rows');
    const header = lines[0].split(',').map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);
    if (idx('sku') === -1 || idx('name') === -1 || idx('priceCents') === -1) {
      throw new BadRequestException('CSV must include at least sku, name, priceCents columns');
    }

    const scoped = this.prisma.forTenant(tenantId);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const sku = cols[idx('sku')];
      const priceCents = Number(cols[idx('priceCents')]);
      if (!sku || !Number.isFinite(priceCents)) {
        errors.push(`Row ${i + 1}: missing sku or invalid priceCents`);
        continue;
      }
      const data = {
        name: cols[idx('name')] || sku,
        description: idx('description') >= 0 ? cols[idx('description')] || undefined : undefined,
        priceCents,
        category: idx('category') >= 0 ? cols[idx('category')] || undefined : undefined,
        gstRateBps: idx('gstRateBps') >= 0 ? Number(cols[idx('gstRateBps')]) || 0 : undefined,
        hsnCode: idx('hsnCode') >= 0 ? cols[idx('hsnCode')] || undefined : undefined,
      };
      const existing = await scoped.product.findFirst({ where: { sku } });
      if (existing) {
        await scoped.product.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await scoped.product.create({
          data: { tenantId, sku, ...data, name: data.name, inventory: { create: { tenantId, quantityOnHand: 0, reorderThreshold: 0 } } },
          include: PRODUCT_INCLUDE,
        });
        created++;
      }
    }
    return { created, updated, errors };
  }
}
