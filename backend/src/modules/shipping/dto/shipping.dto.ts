import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { CheckoutItemDto } from '../../orders/dto/orders.dto';

export const SHIPPING_PROVIDERS = ['shiprocket', 'shipmojo', 'manual'] as const;
export type ShippingProvider = (typeof SHIPPING_PROVIDERS)[number];

export class RateDestinationDto {
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
}

/** Storefront: quote shipping for a cart to a destination before checkout. */
export class QuoteRatesDto {
  @ApiProperty({ type: [CheckoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiProperty({ type: RateDestinationDto })
  @ValidateNested()
  @Type(() => RateDestinationDto)
  destination!: RateDestinationDto;

  @ApiPropertyOptional({ default: false, description: 'Cash on delivery.' })
  @IsOptional()
  @IsBoolean()
  cod?: boolean;
}

/**
 * Admin: connect or update the tenant's shipping account. `secrets` is write-only
 * (carrier login), encrypted at rest, never returned. `config` holds non-secret
 * settings (origin pincode, flat-rate rules); omitting a field on update keeps the
 * stored value.
 */
export class UpsertShippingAccountDto {
  @ApiProperty({ enum: SHIPPING_PROVIDERS })
  @IsIn(SHIPPING_PROVIDERS)
  provider!: ShippingProvider;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Non-secret settings, e.g. { originPostalCode, mode, flatCents }.' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Carrier credentials (write-only), e.g. { email, password }.' })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string>;
}
