import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateFlashSaleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  product_id!: string;

  @ApiProperty({ example: 1999, description: 'Sale price in the smallest currency unit.' })
  @IsInt()
  @Min(0)
  sale_price_cents!: number;

  @ApiProperty({ example: '2026-08-20T00:00:00.000Z' })
  @IsDateString()
  starts_at!: string;

  @ApiProperty({ example: '2026-08-30T00:00:00.000Z' })
  @IsDateString()
  ends_at!: string;
}

export class UpdateFlashSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sale_price_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ends_at?: string;
}
