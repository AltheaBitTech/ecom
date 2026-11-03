import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, Length, Matches } from 'class-validator';

// A permission key looks like `resource:action`, `resource:*`, or the global `*`.
const PERMISSION_KEY = /^(\*|[a-z_]+:(\*|[a-z_]+))$/;

export class CreateRoleDto {
  @ApiProperty({ example: 'Shift Supervisor' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    type: [String],
    example: ['orders:read', 'orders:write', 'products:read'],
    description: 'Permission keys granted to the role. Must exist in the catalog.',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(PERMISSION_KEY, { each: true, message: 'each permission must be a resource:action key' })
  permissions!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(PERMISSION_KEY, { each: true, message: 'each permission must be a resource:action key' })
  permissions?: string[];
}
