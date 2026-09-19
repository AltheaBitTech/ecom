import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayMaxSize, IsBoolean, MaxLength, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength } from 'class-validator';

export class UpdateProductDto {
  @ApiProperty({ required: false, example: 'Herbal Soap 100g' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ required: false, example: 'Handmade herbal soap bar, 100g' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false, example: 4999, description: 'Price in minor currency units (paise for INR)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiProperty({ required: false, example: 'https://images.example.com/soap.jpg' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  compareAtCents?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images?: string[];

  @ApiProperty({ required: false, description: 'HTTPS video URLs (product demo/unboxing clips)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  videos?: string[];

  @ApiProperty({ required: false, example: ['New', 'Bestseller'], description: 'Badge text shown on the storefront card' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(24, { each: true })
  labels?: string[];

  @ApiProperty({ required: false, example: 1800, description: 'GST rate in basis points (1800 = 18%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2800)
  gstRateBps?: number;

  @ApiProperty({ required: false, example: '3401' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  hsnCode?: string;
}
