import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

export interface CloudinaryUploadOptions {
  folder?: string;
  identifier?: string;
  resourceType?: 'auto' | 'image' | 'video' | 'raw';
  publicIdPrefix?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
  bytes: number;
}

@Injectable()
export class CloudinaryUploadHelper {

  async uploadFile(file: Express.Multer.File, options: CloudinaryUploadOptions = {}): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const { folder = 'ai-assistant', identifier, resourceType: forcedResourceType, publicIdPrefix } = options;

      const timestamp = Date.now();
      const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

      let publicId = `${timestamp}-${sanitizedFileName}`;
      if (publicIdPrefix) {
        publicId = `${publicIdPrefix}/${publicId}`;
      }
      if (identifier) {
        publicId = `${identifier}/${publicId}`;
      }

      let targetFolder = folder;
      let resolvedResourceType: 'raw' | 'image' | 'video' | 'auto' = 'auto';

      if (file.mimetype.startsWith('image/')) {
        targetFolder = `${folder}/images`;
        resolvedResourceType = 'image';
      } else if (file.mimetype === 'application/pdf') {
        targetFolder = `${folder}/documents/pdf`;
        resolvedResourceType = 'raw';
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'application/msword') {
        targetFolder = `${folder}/documents/docx`; 
        resolvedResourceType = 'raw';
      } else if (file.mimetype === 'text/csv' || file.mimetype.startsWith('text/')) {
        targetFolder = `${folder}/documents/text`;
        resolvedResourceType = 'raw';
      } else if (file.mimetype.startsWith('audio/')) {
        targetFolder = `${folder}/audio`;
        resolvedResourceType = 'video';
      } else {
        targetFolder = `${folder}/documents/misc`;
        resolvedResourceType = 'raw';
      }

      if (forcedResourceType) {
        resolvedResourceType = forcedResourceType;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: targetFolder,
          resource_type: resolvedResourceType,
          public_id: publicId,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(new Error(`Failed to upload to Cloudinary: ${error.message}`));
          }

          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            resourceType: result.resource_type,
            bytes: result.bytes,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  // Upload multiple files to Cloudinary
  async uploadMultipleFiles( files: Express.Multer.File[], options: CloudinaryUploadOptions = {}): Promise<CloudinaryUploadResult[]> {
    const uploadPromises = files.map((file) => this.uploadFile(file, options));
    return Promise.all(uploadPromises);
  }

  // Upload image specifically (optimized for images)
  async uploadImage( file: Express.Multer.File, identifier?: string): Promise<CloudinaryUploadResult> {
    return this.uploadFile(file, {
      folder: 'ai-assistant/images',
      identifier,
      resourceType: 'image',
    });
  }

  // Upload audio file
  async uploadAudio(file: Express.Multer.File, identifier?: string): Promise<CloudinaryUploadResult> {
    return this.uploadFile(file, {
      folder: 'ai-assistant/audio',
      identifier,
      resourceType: 'video',
    });
  }

  // Upload document (PDF, DOCX, etc.)
  async uploadDocument(file: Express.Multer.File, identifier?: string): Promise<CloudinaryUploadResult> {
    return this.uploadFile(file, {
      folder: 'ai-assistant/documents',
      identifier,
      resourceType: 'auto',
    });
  }

  // Delete file from Cloudinary
  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }as any);
    } catch (error) {
      console.error('Failed to delete file from Cloudinary:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Delete multiple files from Cloudinary 
  async deleteMultipleFiles( publicIds: string[], resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    const deletePromises = publicIds.map((publicId) =>
      this.deleteFile(publicId, resourceType),
    );
    await Promise.all(deletePromises);
  }
}
