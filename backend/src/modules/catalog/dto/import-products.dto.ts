import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ImportProductsDto {
  @ApiProperty({ description: 'Raw CSV text — same columns as the export endpoint (sku, name, priceCents required)' })
  @IsString()
  @MinLength(1)
  csv!: string;
}
