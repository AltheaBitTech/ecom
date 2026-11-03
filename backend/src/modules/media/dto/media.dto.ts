import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMediaUploadDto {
  @IsString()
  @MaxLength(240)
  filename!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  mime_type!: string;

  @IsInt()
  @Min(1)
  @Max(10_485_760)
  size_bytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt_text?: string;
}

export class CompleteMediaUploadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}
