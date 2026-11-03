import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One requested line. Price is NEVER taken from the client — only product + qty. */
export class CheckoutItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  product_id!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class ShippingAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postal_code!: string;

  @ApiProperty({ example: 'IN' })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

/** A cart to be priced server-side (preview) — the checkout body minus address. */
export class PreviewCartDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}

export class CheckoutDto extends PreviewCartDto {
  // Required for guests (no customer token); ignored for signed-in shoppers,
  // whose identity comes from the token. Enforced in the service.
  @ApiPropertyOptional({ description: 'Contact email — required for guest checkout.' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shipping_address!: ShippingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // The shipping option the shopper picked from a rate quote. Validated
  // server-side against a fresh quote; the cheapest is used if omitted/invalid.
  @ApiPropertyOptional({ description: 'Selected shipping service id from /shipping/rates.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shipping_service?: string;
}

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
