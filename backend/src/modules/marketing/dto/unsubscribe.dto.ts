import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class UnsubscribeDto {
  @ApiProperty({ description: 'Customer id from the unsubscribe link' })
  @IsString()
  @Length(1, 100)
  c!: string;

  @ApiProperty({ description: 'HMAC token from the unsubscribe link' })
  @IsString()
  @Length(32, 32)
  t!: string;
}
