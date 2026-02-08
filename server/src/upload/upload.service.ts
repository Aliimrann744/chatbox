import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<{ url: string; filename: string }> {
    if (!file) throw new BadRequestException('No file provided');
    const folderPath = path.join(this.uploadDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    const filepath = path.join(folderPath, filename);

    fs.writeFileSync(filepath, file.buffer);

    const baseUrl = this.configService.get<string>('BASE_URL');
    const url = `${baseUrl}/uploads/${folder}/${filename}`;

    return { url, filename };
  }

  async deleteFile(filepath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filepath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
