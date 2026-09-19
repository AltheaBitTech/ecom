import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'FULFILLED', 'CANCELLED'] as const;

export class ListOrdersDto {
  @ApiProperty({ required: false, enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiProperty({ required: false, description: 'ISO date; filters createdAt >= from' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date; filters createdAt <= to' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, description: 'Matches customer name/email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiProperty({ required: false, enum: ['createdAt', 'totalCents'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'totalCents'])
  sortBy?: 'createdAt' | 'totalCents';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
