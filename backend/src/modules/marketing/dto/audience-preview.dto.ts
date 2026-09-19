import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { AUDIENCES, CHANNELS, type Audience, type Channel } from '../marketing.schemas';

export class AudiencePreviewDto {
  @ApiProperty({ enum: AUDIENCES })
  @IsIn(AUDIENCES as unknown as string[])
  audience!: Audience;

  @ApiProperty({ enum: CHANNELS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(CHANNELS as unknown as string[], { each: true })
  channels!: Channel[];

  @ApiPropertyOptional({ type: [String], description: 'Required when audience is "selected".' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  customerIds?: string[];
}
