import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppConfig } from '../../common/config/app-config';
import { AppException } from '../../common/errors/app-exception';

@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    this.client = new S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      forcePathStyle: config.s3ForcePathStyle,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.s3Bucket }));
    } catch {
      try { await this.client.send(new CreateBucketCommand({ Bucket: this.config.s3Bucket })); } catch { /* another instance may have created it */ }
    }
    await this.client.send(new PutBucketCorsCommand({ Bucket: this.config.s3Bucket, CORSConfiguration: { CORSRules: [{ AllowedMethods: ['PUT', 'GET'], AllowedOrigins: [this.config.appBaseUrl], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }] } })).catch(() => undefined);
  }

  uploadUrl(objectKey: string, mimeType: string): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.config.s3Bucket, Key: objectKey, ContentType: mimeType }), { expiresIn: 900 });
  }

  downloadUrl(objectKey: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.s3Bucket, Key: objectKey }), { expiresIn: 300 });
  }

  async verify(objectKey: string, expectedSize: number, expectedMime: string): Promise<void> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: objectKey }));
      if (result.ContentLength !== expectedSize || result.ContentType !== expectedMime) throw AppException.validation('Uploaded file does not match the declared size or type');
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw AppException.validation('Upload was not found in media storage');
    }
  }
}
