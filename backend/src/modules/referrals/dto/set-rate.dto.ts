import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetRateDto {
  @ApiProperty({
    required: false,
    example: 2000,
    minimum: 0,
    maximum: 10000,
    description: 'Basis points (1000 = 10%). Omit/null to clear the override and fall back to the platform default.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionBps?: number | null;
}
