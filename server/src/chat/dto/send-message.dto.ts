import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  chatId: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  mediaType?: string;

  @IsNumber()
  @IsOptional()
  mediaDuration?: number;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsString()
  @IsOptional()
  replyToId?: string;

  @IsBoolean()
  @IsOptional()
  isForwarded?: boolean;

  @IsString()
  @IsOptional()
  tempId?: string; // Client-side temporary ID for optimistic updates
}
