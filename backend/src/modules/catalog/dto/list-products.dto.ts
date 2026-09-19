import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListProductsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiProperty({ required: false, description: 'Matches name/sku' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiProperty({ required: false, enum: ['published', 'archived', 'draft'] })
  @IsOptional()
  @IsIn(['published', 'archived', 'draft'])
  status?: 'published' | 'archived' | 'draft';

  @ApiProperty({ required: false, enum: ['createdAt', 'priceCents', 'name'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'priceCents', 'name'])
  sortBy?: 'createdAt' | 'priceCents' | 'name';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @ApiProperty({ required: false, enum: ['true', 'false'], description: 'Include archived products in the list' })
  @IsOptional()
  @IsIn(['true', 'false'])
  includeArchived?: 'true' | 'false';
}
