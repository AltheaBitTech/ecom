import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

/** Shared cursor pagination for the platform directory + audit lists. */
class PlatformListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class UserDirectoryQueryDto extends PlatformListQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive email substring filter.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;
}

export class AuditQueryDto extends PlatformListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action name (exact match).' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  action?: string;

  @ApiPropertyOptional({ description: "Filter to a single tenant's entries." })
  @IsOptional()
  @IsString()
  tenant_id?: string;
}
