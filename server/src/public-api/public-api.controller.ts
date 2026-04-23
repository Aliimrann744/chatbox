import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PublicApiService } from './public-api.service';
import { SendTextMessageDto } from './dto/send-text-message.dto';
import { SendVoiceMessageDto } from './dto/send-voice-message.dto';

const VOICE_FILE_SIZE_LIMIT = 25 * 1024 * 1024; // 25 MB — generous for any voice note

const VOICE_ALLOWED_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
];

/**
 * Public-facing integration API. Not covered by the global JwtAuthGuard
 * (each handler is marked @Public()) and instead authenticates with an
 * x-api-key header validated by ApiKeyGuard.
 *
 *   POST /api/public/v1/messages/text
 *        { phone, content, externalId? }
 *
 *   POST /api/public/v1/messages/voice  (multipart/form-data)
 *        voice=<audio file>  phone=<string>  duration=<seconds>?  externalId?
 */
@Controller('public/v1/messages')
@UseGuards(ApiKeyGuard)
@Public()
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Post('text')
  async sendText(@Req() req: Request, @Body() dto: SendTextMessageDto) {
    return this.publicApiService.sendTextMessage(
      req.apiCaller!,
      dto.phone,
      dto.content,
      dto.externalId,
    );
  }

  @Post('voice')
  @UseInterceptors(
    FileInterceptor('voice', {
      storage: diskStorage({
        destination: './tmp',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(
            file.originalname || '',
          )}`;
          cb(null, unique);
        },
      }),
      limits: { fileSize: VOICE_FILE_SIZE_LIMIT },
      fileFilter: (_req, file, cb) => {
        if (VOICE_ALLOWED_MIMES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported audio format "${file.mimetype}". Allowed: ${VOICE_ALLOWED_MIMES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  async sendVoice(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendVoiceMessageDto,
  ) {
    return this.publicApiService.sendVoiceMessage(
      req.apiCaller!,
      dto.phone,
      file,
      dto.duration,
      dto.externalId,
    );
  }
}
