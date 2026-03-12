import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rename, writeFile, unlink, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { promisify } from 'util';
import { randomBytes } from 'crypto';

const renameAsync = promisify(rename);
const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlink);

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/x-m4a': '.m4a',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

@Injectable()
export class UploadService {
  private baseUrl: string;
  private uploadsRoot: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('BASE_URL');
    this.uploadsRoot = join(process.cwd(), 'uploads');
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<{ url: string; filename: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const ext = extname(file.originalname) || mimeToExt[file.mimetype] || '';
    const uniqueName = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    const targetDir = join(this.uploadsRoot, folder);
    const targetPath = join(targetDir, uniqueName);

    // Ensure target directory exists
    mkdirSync(targetDir, { recursive: true });

    if (file.path) {
      // Disk storage (upload controller) — move temp file to uploads
      await renameAsync(file.path, targetPath);
    } else if (file.buffer) {
      // Memory storage (auth controller) — write buffer to disk
      await writeFileAsync(targetPath, file.buffer);
    } else {
      throw new BadRequestException('File has no path or buffer');
    }

    return {
      url: `${this.baseUrl}/uploads/${folder}/${uniqueName}`,
      filename: `${folder}/${uniqueName}`,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = join(this.uploadsRoot, filePath);
      await unlinkAsync(fullPath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }
}
