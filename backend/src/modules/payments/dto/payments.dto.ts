import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const PAYMENT_PROVIDERS = ['razorpay', 'manual'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Admin: connect or update a tenant's payment account. Secret fields are
 * write-only — accepted here, encrypted at rest, and NEVER returned. Omitting a
 * secret on update leaves the stored value untouched (so a merchant can toggle
 * `enabled` without re-entering keys).
 */
export class UpsertPaymentAccountDto {
  @ApiProperty({ enum: PAYMENT_PROVIDERS })
  @IsIn(PAYMENT_PROVIDERS)
  provider!: PaymentProvider;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Public key id (Razorpay key_id).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public_key?: string;

  @ApiPropertyOptional({ description: 'Secret key. Write-only; never returned.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  secret_key?: string;

  @ApiPropertyOptional({ description: 'Webhook signing secret. Write-only; never returned.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  webhook_secret?: string;
}

/** Client's post-payment callback from the gateway SDK (Razorpay field names). */
export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  provider_order_id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  provider_payment_id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(400)
  signature!: string;
}
