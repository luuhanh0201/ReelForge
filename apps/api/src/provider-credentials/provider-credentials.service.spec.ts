import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import type { AuditLogService } from '../audit/audit-log.service.js';
import type { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';
import { ProviderCredential } from './provider-credential.entity.js';
import { ProviderCredentialsService } from './provider-credentials.service.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const serviceAccountFile = Buffer.from(
  JSON.stringify({
    type: 'service_account',
    project_id: 'reelforge-dev',
    private_key_id: 'aabbccdda91f',
    private_key: pem.replace(/\n/g, '\\n'),
    client_email: 'reelforge-tts@reelforge-dev.iam.gserviceaccount.com',
  }),
  'utf8',
);

const encryption = new AesGcmEncryptionService({
  getOrThrow: () => ({ keys: { 1: Buffer.alloc(32, 7).toString('base64') }, activeVersion: 1 }),
} as unknown as ConfigService);

const build = () => {
  const save = vi.fn(async (record: ProviderCredential) => record);
  const repository = {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    save,
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as Repository<ProviderCredential>;

  const dataSource = {
    transaction: vi.fn(async (handler: (manager: unknown) => Promise<unknown>) =>
      handler({ getRepository: () => repository }),
    ),
  } as unknown as DataSource;

  const verify = vi.fn().mockResolvedValue({ latencyMs: 120, voiceCount: 28 });
  const verifier = { verify } as unknown as GoogleTtsCredentialVerifierService;

  const record = vi.fn().mockResolvedValue(undefined);
  const auditLogs = { record } as unknown as AuditLogService;

  const service = new ProviderCredentialsService(
    repository,
    dataSource,
    encryption,
    verifier,
    auditLogs,
  );

  return { service, repository, save, verify, audit: record };
};

describe('ProviderCredentialsService.upload', () => {
  let context: ReturnType<typeof build>;

  beforeEach(() => {
    context = build();
  });

  it('lưu credential và chỉ trả về metadata đã che', async () => {
    const view = await context.service.upload(serviceAccountFile, '127.0.0.1');

    expect(view).toEqual({
      provider: 'google-tts',
      configured: true,
      projectId: 'reelforge-dev',
      clientEmailMasked: 'ree***@***.iam.gserviceaccount.com',
      privateKeyIdSuffix: 'a91f',
      status: 'connected',
      latencyMs: 120,
      lastVerifiedAt: expect.any(String) as unknown as string,
      keyVersion: 1,
    });

    // Không có mẩu bí mật nào lọt ra response
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('BEGIN PRIVATE KEY');
    expect(serialized).not.toContain('reelforge-tts@reelforge-dev.iam.gserviceaccount.com');
  });

  it('payload trong database là ciphertext, giải mã lại đúng bản gốc', async () => {
    await context.service.upload(serviceAccountFile, null);

    const saved = context.save.mock.calls[0]![0];
    expect(saved.encryptedPayload.toString('utf8')).not.toContain('BEGIN PRIVATE KEY');
    expect(saved.iv).toHaveLength(12);
    expect(saved.authTag).toHaveLength(16);
    expect(saved.algorithm).toBe('aes-256-gcm');

    const plaintext = encryption.decrypt(
      {
        ciphertext: saved.encryptedPayload,
        iv: saved.iv,
        authTag: saved.authTag,
        algorithm: saved.algorithm,
        keyVersion: saved.encryptionKeyVersion,
      },
      `google-tts|${saved.id}|${saved.encryptionKeyVersion}`,
    );

    expect(JSON.parse(plaintext).client_email).toBe(
      'reelforge-tts@reelforge-dev.iam.gserviceaccount.com',
    );
  });

  it('Google từ chối thì KHÔNG ghi database', async () => {
    context.verify.mockRejectedValueOnce(new BusinessException('GOOGLE_TTS_AUTH_FAILED'));

    await expect(context.service.upload(serviceAccountFile, null)).rejects.toMatchObject({
      code: 'GOOGLE_TTS_AUTH_FAILED',
    });
    expect(context.save).not.toHaveBeenCalled();
  });

  it('file hỏng thì dừng trước khi gọi Google', async () => {
    await expect(
      context.service.upload(Buffer.from('{khong-phai-json', 'utf8'), null),
    ).rejects.toMatchObject({ code: 'INVALID_SERVICE_ACCOUNT' });

    expect(context.verify).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
  });

  it('nhật ký kiểm toán không chứa bí mật', async () => {
    await context.service.upload(serviceAccountFile, '127.0.0.1');

    const entry = JSON.stringify(context.audit.mock.calls[0]![0]);
    expect(entry).not.toContain('BEGIN PRIVATE KEY');
    expect(entry).not.toContain('reelforge-tts@reelforge-dev.iam.gserviceaccount.com');
    expect(entry).toContain('ree***@***.iam.gserviceaccount.com');
  });

  it('ghi database hỏng thì lỗi nổi lên, credential cũ không bị đụng', async () => {
    context.save.mockRejectedValueOnce(new Error('connection reset'));

    await expect(context.service.upload(serviceAccountFile, null)).rejects.toThrow(
      'connection reset',
    );
  });
});

describe('ProviderCredentialsService.getStatus', () => {
  it('báo chưa cấu hình khi database trống', async () => {
    const { service } = build();
    const view = await service.getStatus();

    expect(view.configured).toBe(false);
    expect(view.projectId).toBeNull();
  });
});
