import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from '../../common/auth/audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import type { AuthContext } from '../../common/auth/request-context';
import { PERMISSIONS } from '../roles/permissions.catalog';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { ImportProductsDto } from './dto/import-products.dto';

@ApiTags('catalog')
@ApiBearerAuth('access-token')
@Controller('products')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  @ApiOperation({ summary: 'List products for the caller\'s tenant', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_VIEW}` })
  list(@CurrentUser() user: AuthContext, @Query('includeArchived') includeArchived: string | undefined, @Query() query: ListProductsDto) {
    return this.catalog.list(user.tenantId, includeArchived === 'true', query);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export products as CSV', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_VIEW}` })
  async export(@CurrentUser() user: AuthContext, @Res() res: Response) {
    const csv = await this.catalog.exportCsv(user.tenantId);
    res.setHeader('Content-Disposition', `attachment; filename="products.csv"`);
    res.send(csv);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Bulk create/update products from CSV', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Upserts by sku.` })
  async import(@CurrentUser() user: AuthContext, @Body() dto: ImportProductsDto) {
    const result = await this.catalog.importCsv(user.tenantId, dto.csv);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.import',
      resourceType: 'Product',
      resourceId: 'bulk',
      newValue: result,
    });
    return result;
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_VIEW)
  @ApiOperation({ summary: 'Get a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_VIEW}` })
  findOne(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.catalog.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Create a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}` })
  async create(@CurrentUser() user: AuthContext, @Body() dto: CreateProductDto) {
    const product = await this.catalog.create(user.tenantId, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.create',
      resourceType: 'Product',
      resourceId: product.id,
      newValue: { sku: product.sku, name: product.name, priceCents: product.priceCents },
    });
    return product;
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Update a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}` })
  async update(@CurrentUser() user: AuthContext, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    const product = await this.catalog.update(user.tenantId, id, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.update',
      resourceType: 'Product',
      resourceId: id,
      newValue: dto,
    });
    return product;
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Archive a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Archived products are hidden by default and cannot be added to new orders.` })
  async archive(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const product = await this.catalog.archive(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.archive',
      resourceType: 'Product',
      resourceId: id,
    });
    return product;
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Publish a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Requires name, sku and a positive priceCents.` })
  async publish(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const product = await this.catalog.publish(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.publish',
      resourceType: 'Product',
      resourceId: id,
    });
    return product;
  }

  @Post(':id/unpublish')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Unpublish a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Moves the product back to draft.` })
  async unpublish(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    const product = await this.catalog.unpublish(user.tenantId, id);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.unpublish',
      resourceType: 'Product',
      resourceId: id,
    });
    return product;
  }

  @Post(':id/variants')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Add a variant to a product', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Label is free text (size, weight, or any other axis).` })
  async addVariant(@CurrentUser() user: AuthContext, @Param('id') productId: string, @Body() dto: CreateVariantDto) {
    const variant = await this.catalog.addVariant(user.tenantId, productId, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.variant.create',
      resourceType: 'ProductVariant',
      resourceId: variant.id,
      newValue: { productId, label: variant.label, priceCents: variant.priceCents },
    });
    return variant;
  }

  @Patch(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Update a product variant', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}` })
  async updateVariant(
    @CurrentUser() user: AuthContext,
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    const variant = await this.catalog.updateVariant(user.tenantId, productId, variantId, dto);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.variant.update',
      resourceType: 'ProductVariant',
      resourceId: variantId,
      newValue: dto,
    });
    return variant;
  }

  @Delete(':id/variants/:variantId')
  @RequirePermissions(PERMISSIONS.CATALOG_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Archive a product variant', description: `Requires ${PERMISSIONS.CATALOG_PRODUCTS_MANAGE}. Past orders keep their snapshot of it.` })
  async archiveVariant(@CurrentUser() user: AuthContext, @Param('id') productId: string, @Param('variantId') variantId: string) {
    const variant = await this.catalog.archiveVariant(user.tenantId, productId, variantId);
    await this.audit.log({
      tenantId: user.tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      action: 'product.variant.archive',
      resourceType: 'ProductVariant',
      resourceId: variantId,
    });
    return variant;
  }
}
