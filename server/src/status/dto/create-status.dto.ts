import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateStatusDto {
  @IsEnum(['IMAGE', 'VIDEO'])
  type: 'IMAGE' | 'VIDEO';

  @IsString()
  mediaUrl: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
