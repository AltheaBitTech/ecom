import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, MembershipType } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class InviteStaffDto {
  @ApiProperty({ example: 'new.hire@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Id of the role to grant within this tenant.' })
  @IsString()
  @IsNotEmpty()
  role_id!: string;

  @ApiPropertyOptional({ enum: MembershipType, default: MembershipType.STAFF })
  @IsOptional()
  @IsEnum(MembershipType)
  type?: MembershipType;

  @ApiPropertyOptional({ example: 'New Hire' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}

export class UpdateMembershipDto {
  @ApiPropertyOptional({ description: 'New role id within the tenant.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role_id?: string;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'The single-use invite token from the invitation.' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    minLength: 12,
    description: 'Required only when the invited user does not yet have a password.',
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}
