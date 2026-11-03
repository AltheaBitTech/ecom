import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

export class IntrospectDto {
  @ApiProperty({ description: 'The access token (JWT) to introspect.' })
  @IsJWT()
  token!: string;
}

export class RevokeDto {
  @ApiProperty({ description: 'Id of the session to revoke.' })
  @IsString()
  @IsNotEmpty()
  session_id!: string;
}
