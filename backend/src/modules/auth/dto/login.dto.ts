import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'acme-co' })
  @IsString()
  tenantSlug!: string;

  @ApiProperty({ example: 'owner@acme.co' })
  @IsEmail()
  email!: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(1)
  password!: string;
}
