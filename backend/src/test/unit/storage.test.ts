import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable config — vi.hoisted() ensures it's ready before vi.mock() factories run
const mockMinioConfig = vi.hoisted(() => ({
  endpoint: 'minio-svc',
  port: 9000,
  publicUrl: null as string | null,
  bucket: 'test-bucket',
  accessKey: 'key',
  secretKey: 'secret',
}));

vi.mock('../../config', () => ({
  config: { minio: mockMinioConfig },
}));

const mockSend = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

import { uploadFile, deleteFile } from '../../storage';

describe('uploadFile', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('calls PutObjectCommand with correct bucket/key/contentType', async () => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    mockMinioConfig.publicUrl = 'https://example.com/minio';

    await uploadFile(Buffer.from('data'), 'vehicles/abc/img.jpg', 'image/jpeg');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'vehicles/abc/img.jpg',
        ContentType: 'image/jpeg',
      }),
    );
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it('returns URL using publicUrl when set', async () => {
    mockMinioConfig.publicUrl = 'https://demo.aidevcowork.com/minio';
    const url = await uploadFile(Buffer.from('x'), 'vehicles/test.jpg', 'image/jpeg');
    expect(url).toBe('https://demo.aidevcowork.com/minio/test-bucket/vehicles/test.jpg');
  });

  it('falls back to http://endpoint:port when publicUrl is null', async () => {
    mockMinioConfig.publicUrl = null;
    const url = await uploadFile(Buffer.from('x'), 'vehicles/test.jpg', 'image/jpeg');
    expect(url).toBe('http://minio-svc:9000/test-bucket/vehicles/test.jpg');
  });
});

describe('deleteFile', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('calls DeleteObjectCommand with correct key', async () => {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await deleteFile('vehicles/abc/img.jpg');
    expect(DeleteObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'vehicles/abc/img.jpg' }),
    );
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
