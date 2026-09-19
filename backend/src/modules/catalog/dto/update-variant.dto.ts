import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, MinLength, MaxLength, IsString } from 'class-validator';

export class UpdateVariantDto {
  @ApiProperty({ required: false, example: '500 Gram' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @ApiProperty({ required: false, example: 45000, description: 'Price in minor currency units (paise for INR)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  compareAtCents?: number | null;
}
