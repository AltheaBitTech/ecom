import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { IsGstin, IsPan } from '../../../common/validation/tax-id.validator';

export class UpdateTenantTaxInfoDto {
  @ApiProperty({ required: false, example: 'Acme Co', description: 'Business (display) name. Slug is unchanged.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false, example: '27ABCDE1234F1Z0' })
  @IsOptional()
  @IsString()
  @IsGstin()
  gstin?: string;

  @ApiProperty({ required: false, example: 'Acme Private Limited' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiProperty({ required: false, example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @IsPan()
  pan?: string;

  @ApiProperty({ required: false, description: 'Free-form billing address' })
  @IsOptional()
  @IsObject()
  billingAddress?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'HTTPS URL to a hosted logo image, printed on invoices' })
  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  logoUrl?: string;

  @ApiProperty({ required: false, example: 'Karnataka', description: 'Home state for GST place-of-supply (CGST+SGST vs IGST)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;
}
