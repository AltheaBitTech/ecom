import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength, MaxLength, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ example: -5, description: 'Signed change to quantity on hand (negative to remove stock)' })
  @IsInt()
  @NotEquals(0)
  @Min(-1_000_000)
  @Max(1_000_000)
  delta!: number;

  @ApiProperty({ example: 'Damaged in warehouse' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
