import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Self-serve onboarding: create the store + its owner (internal caller). */
export class ProvisionTenantDto {
  @ApiProperty({ example: 'Acme Groceries' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'owner@acme.test' })
  @IsEmail()
  owner_email!: string;

  @ApiProperty({
    example: 'correct horse battery staple',
    minLength: 12,
    description: "The owner's initial password (min 12 chars). Set on the auth side so the owner can sign in immediately after onboarding.",
  })
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  owner_password!: string;

  @ApiPropertyOptional({ example: 'Dana Owner', description: "The owner's display name." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  owner_name?: string;

  @ApiProperty({ example: 'acme', description: 'Subdomain label; must be unique.' })
  @IsString()
  @MinLength(2)
  @MaxLength(63)
  slug!: string;

  @ApiPropertyOptional({ enum: ['starter', 'pro', 'enterprise'], default: 'starter' })
  @IsOptional()
  @IsIn(['starter', 'pro', 'enterprise'])
  plan_key?: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Acme Groceries' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  store_name?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({ example: 'shop.acme.com', description: 'Requires the customDomains feature.' })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  custom_domain?: string;
}

export class SaveStoreDesignDto {
  @IsObject()
  design!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  expected_revision?: number;
}

/** Replace the tenant's product attribute JSON Schema (draft-07). */
export class SetAttributeSchemaDto {
  @ApiProperty({
    description: 'JSON Schema describing allowed product custom_attributes.',
    example: {
      type: 'object',
      required: ['expiry_date'],
      properties: { expiry_date: { type: 'string', format: 'date' } },
      additionalProperties: false,
    },
  })
  @IsObject()
  schema!: Record<string, unknown>;
}
