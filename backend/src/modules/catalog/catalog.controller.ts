import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth, Public, RequirePermission } from '../../common/auth/decorators';

import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ListProductsQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';
import { ProductsService } from './products.service';

/** Admin catalog management — staff, gated by products:* permissions. */
@ApiTags('catalog-admin')
@Controller('tenants/:tenantId')
@Auth('staff', 'internal')
export class CatalogAdminController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  // --- Products --------------------------------------------------------------
  @Post('products')
  @RequirePermission('products:write')
  createProduct(@Param('tenantId') tenantId: string, @Body() dto: CreateProductDto) {
    return this.products.create(tenantId, dto);
  }

  @Get('products')
  @RequirePermission('products:read')
  listProducts(@Param('tenantId') tenantId: string, @Query() query: ListProductsQueryDto) {
    return this.products.list(tenantId, query);
  }

  @Get('products/:id')
  @RequirePermission('products:read')
  getProduct(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.products.get(tenantId, id);
  }

  @Patch('products/:id')
  @RequirePermission('products:write')
  updateProduct(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(tenantId, id, dto);
  }

  @Delete('products/:id')
  @RequirePermission('products:write')
  deleteProduct(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.products.remove(tenantId, id);
  }

  // --- Categories ------------------------------------------------------------
  @Post('categories')
  @RequirePermission('products:write')
  createCategory(@Param('tenantId') tenantId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(tenantId, dto);
  }

  @Get('categories')
  @RequirePermission('products:read')
  listCategories(@Param('tenantId') tenantId: string) {
    return this.categories.list(tenantId);
  }

  @Patch('categories/:id')
  @RequirePermission('products:write')
  updateCategory(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('products:write')
  deleteCategory(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.categories.remove(tenantId, id);
  }
}

/**
 * Public storefront catalog — no credential. Shoppers browse ACTIVE products
 * for a store by its tenant id. RLS still scopes every read to that tenant.
 */
@ApiTags('storefront')
@Controller('storefront/:tenantId')
export class StorefrontCatalogController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  @Get('products')
  @Public()
  listProducts(@Param('tenantId') tenantId: string, @Query() query: ListProductsQueryDto) {
    return this.products.listPublished(tenantId, query);
  }

  @Get('products/:id')
  @Public()
  getProduct(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.products.getPublished(tenantId, id);
  }

  @Get('categories')
  @Public()
  listCategories(@Param('tenantId') tenantId: string) {
    return this.categories.list(tenantId);
  }
}
