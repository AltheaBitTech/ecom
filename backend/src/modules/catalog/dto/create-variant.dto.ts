import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, MinLength, MaxLength, IsString } from 'class-validator';

export class CreateVariantDto {
  // Free text by design — "Half"/"Full", "70 Gram"/"1 Kg", or any future axis a seller needs.
  // One mechanism covers every product type instead of a fixed weight/size enum.
  @ApiProperty({ example: '500 Gram' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ example: 45000, description: 'Price in minor currency units (paise for INR)' })
  @IsInt()
  @Min(0)
  priceCents!: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  compareAtCents?: number | null;
}
