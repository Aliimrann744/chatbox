import { IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsOptional()
  participantId?: string; // For private chat

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  participantIds?: string[]; // For group chat

  @IsString()
  @IsOptional()
  name?: string; // Group name

  @IsString()
  @IsOptional()
  description?: string; // Group description

  @IsString()
  @IsOptional()
  avatar?: string; // Group avatar
}
