import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<{ url: string; filename: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `chatbox/${folder}`,
          resource_type: 'auto',
          timeout: 60000,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });

    return {
      url: result.secure_url,
      filename: result.public_id,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Failed to delete file from Cloudinary:', error);
    }
  }
}
