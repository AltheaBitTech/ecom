import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProductDto {
  @ApiProperty({ example: 'Organic Bananas' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'organic-bananas' })
  @IsString()
  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric with single hyphens' })
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: 4999, description: 'Price in the smallest currency unit (paise/cents).' })
  @IsInt()
  @Min(0)
  price_cents!: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter uppercase code' })
  currency?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  stock?: number;

  @ApiPropertyOptional({ type: [String], example: ['https://cdn.example/banana.jpg'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Original price in minor units; must be greater than the selling price.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  compare_at_price_cents?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_bestseller?: boolean;

  @ApiPropertyOptional({ example: 'Limited drop', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  badge?: string;

  @ApiPropertyOptional({
    description: 'Tenant-defined attributes, validated against the store schema.',
    example: { expiry_date: '2026-09-01', organic: true },
  })
  @IsOptional()
  @IsObject()
  custom_attributes?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  compare_at_price_cents?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_bestseller?: boolean;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  badge?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  custom_attributes?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_id?: string | null;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

/** Sort orders offered to the storefront. Each is backed by a stable keyset. */
export enum ProductSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Filter to a single category.' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive search over name and description.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Minimum price in the smallest currency unit.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price in the smallest currency unit.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional({ description: 'Only products with stock > 0.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  in_stock?: boolean;

  @ApiPropertyOptional({ enum: ProductSort, default: ProductSort.NEWEST })
  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Fresh Produce' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'fresh-produce' })
  @IsString()
  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric with single hyphens' })
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  image_url?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parent_id?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  image_url?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
}
