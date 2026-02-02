import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  async uploadImage(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'ai-assistant', resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadAudio(file: Express.Multer.File, patientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const publicId = `audio-recordings/${patientId}/${timestamp}`;
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ai-assistant/audio',
          resource_type: 'video',
          public_id: publicId,
          format: 'webm',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async uploadPdf(buffer: Buffer, patientId: string, filename: string): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const publicId = `${patientId}/${timestamp}-${filename.replace(/\.pdf$/i, '')}`;
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ai-assistant/patient-reports',
          resource_type: 'raw',
          type: 'upload',
          access_mode: 'public',
          public_id: publicId,
          format: 'pdf',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async uploadPdfFromFile(file: Express.Multer.File, patientId: string): Promise<{ url: string; publicId: string }> {
    return this.uploadPdf(file.buffer, patientId, file.originalname);
  }

  async uploadReportImage(buffer: Buffer, patientId: string, filename: string): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const publicId = `${patientId}/${timestamp}-${filename.replace(/\.(png|jpg|jpeg)$/i, '')}`;
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ai-assistant/patient-reports',
          resource_type: 'image',
          type: 'upload',
          access_mode: 'public',
          public_id: publicId,
          format: 'png',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async uploadAnyFile(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ai-assistant/documents',
          resource_type: 'auto',
          public_id: `${Date.now()}-${file?.originalname}`,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
