import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Shopper self-service DTOs. `tenant_id` is never a body field — it always comes
 * from the store-scoped route (`storefront/:tenantId/...`), so a shopper can only
 * ever act within the store they are browsing.
 */
export class CustomerSignupDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  // auth-rbac enforces a 12-char minimum; mirror it here for a fast, local reject.
  @ApiProperty({ minLength: 12, example: 'correct horse battery' })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters.' })
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class CustomerLoginDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;
}

/** A saved shipping/billing destination in the shopper's address book. */
export class UpsertAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiProperty({ example: 'Asha Rao' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  full_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ example: '560001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postal_code!: string;

  @ApiProperty({ example: 'IN' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  country!: string;

  @ApiPropertyOptional({ description: 'Make this the default address.' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
