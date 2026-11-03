import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '482913', description: 'A 6-digit TOTP code from the authenticator app.' })
  @IsString()
  @Length(6, 6)
  totp_code!: string;
}
