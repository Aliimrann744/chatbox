import { Controller, Post, UseInterceptors, UploadedFile, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { allowedMimeTypes } from 'src/constant/mime-types';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './tmp',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (allowedMimeTypes.includes(file.mimetype)) { callback(null, true); } 
        else { callback(new BadRequestException('Invalid file type'), false); }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('folder') folder?: string) {
    return this.uploadService.uploadFile(file, folder);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only JPEG, PNG, and WebP images are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file, 'avatars');
  }
}
