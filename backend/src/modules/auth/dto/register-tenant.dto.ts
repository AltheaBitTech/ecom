import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsGstin, IsPan } from '../../../common/validation/tax-id.validator';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Acme Co', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName!: string;

  @ApiProperty({ example: 'owner@acme.co' })
  @IsEmail()
  ownerEmail!: string;

  // Length only here; strength (upper/lower/digit/symbol) is enforced in AuthService
  // so the message can name exactly what's missing.
  @ApiProperty({
    writeOnly: true,
    minLength: 12,
    maxLength: 128,
    description: 'Min 12 chars, 3 of 4 character classes (upper/lower/digit/symbol)',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, example: '27ABCDE1234F1Z0', description: 'GSTIN, can be added later in tenant settings' })
  @IsOptional()
  @IsString()
  @IsGstin()
  gstin?: string;

  @ApiProperty({ example: 'Acme Private Limited', minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @ApiProperty({ required: false, example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @IsPan()
  pan?: string;

  @ApiProperty({ required: false, example: 'ACME-A1B2C3', description: 'Referral code from an existing tenant (?ref=CODE), if any' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralCode?: string;
}
