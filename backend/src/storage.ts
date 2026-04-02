import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { config } from './config';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: `http://${config.minio.endpoint}:${config.minio.port}`,
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  const publicBase = config.minio.publicUrl
    ?? `http://${config.minio.endpoint}:${config.minio.port}`;
  return `${publicBase}/${config.minio.bucket}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
    }),
  );
}
