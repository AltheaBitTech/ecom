import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** A `resource:action` permission key, or a wildcard — matches auth-rbac's catalog format. */
const PERMISSION_KEY = /^(\*|[a-z_]+:(\*|[a-z_]+))$/;

/**
 * Staff (merchant admin) sign-in. `tenant_id` and `product_id` are never body
 * fields — the tenant comes from the store-scoped route (`admin/:tenantId/...`)
 * and the product is fixed to this deployment, so a staff member can only ever
 * sign in to the store they are administering.
 */
export class StaffLoginDto {
  @ApiProperty({ example: 'owner@acme.test' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

/** Cursor pagination shared by the roles + staff lists. */
export class AdminListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Fulfilment' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: [String], example: ['orders:read', 'orders:write'] })
  @IsArray()
  @ArrayUnique()
  @Matches(PERMISSION_KEY, { each: true, message: 'each permission must be a resource:action key' })
  permissions!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Fulfilment' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: [String], description: 'Replaces the full permission set.' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(PERMISSION_KEY, { each: true, message: 'each permission must be a resource:action key' })
  permissions?: string[];
}

export class InviteStaffDto {
  @ApiProperty({ example: 'teammate@acme.test' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Role to grant on the tenant.' })
  @IsString()
  @IsNotEmpty()
  role_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class UpdateMembershipDto {
  @ApiPropertyOptional({ description: 'Reassign the staff member to a different role.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role_id?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;
}
