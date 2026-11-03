import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MinLength } from 'class-validator';

/**
 * Staff identity DTOs. The tenant is always taken from the store-scoped route
 * (`admin/:tenantId/...`) and the product is fixed to this deployment, so neither
 * `tenant_id` nor `product_id` are ever body fields.
 */
export class RegisterDto {
  @ApiProperty({ example: 'dr.mehta@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 12, description: 'Minimum 12 characters.' })
  @IsString()
  @MinLength(12)
  password!: string;

  @ApiPropertyOptional({ example: 'Dr. Mehta' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'dr.mehta@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class MfaVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  login_session_id!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(6, 6)
  totp_code!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The single-use token from the reset email.' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  new_password!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'The single-use token from the verification email.' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}
