import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class OrderLineDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  productId!: string;

  @ApiProperty({ required: false, example: 'e5f6a7b8-...', description: 'One of the product\'s variants, if it has any' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'c1d2e3f4-...' })
  @IsString()
  customerId!: string;

  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
