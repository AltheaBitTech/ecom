import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class StorefrontOrderLineDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Guest checkout — no account required. Identifies the buyer by email, reused across orders. */
export class StorefrontCheckoutDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @MinLength(1)
  customerName!: string;

  @ApiProperty({ example: 'priya@example.com' })
  @IsEmail()
  customerEmail!: string;

  @ApiProperty({ required: false, example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ type: [StorefrontOrderLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderLineDto)
  items!: StorefrontOrderLineDto[];
}
