import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const STATUSES = ['APPROVED', 'REJECTED', 'REFUNDED'] as const;

export class ResolveReturnDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];

  @ApiProperty({ required: false, description: 'Refund amount in cents — set when status is REFUNDED' })
  @IsOptional()
  @IsInt()
  @Min(0)
  refundCents?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
