import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Out of stock at the warehouse', description: 'Shown to the customer in the cancellation notification and recorded on the order timeline.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
