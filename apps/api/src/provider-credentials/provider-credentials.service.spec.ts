import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { AesGcmEncryptionService } from '../common/security/aes-gcm-encryption.service.js';
import type { AuditLogService } from '../audit/audit-log.service.js';
import type { GoogleTtsCredentialVerifierService } from './google-tts-credential-verifier.service.js';
import { GeminiCredentialSpec } from './gemini.credential.js';
import { GoogleTtsCredentialSpec } from './google-tts.credential.js';
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
  const googleTts = new GoogleTtsCredentialSpec(verifier);

  const verifyGemini = vi.fn().mockResolvedValue({ latencyMs: 90, metadata: { modelCount: 12 } });
  const gemini = new GeminiCredentialSpec();
  gemini.verify = verifyGemini;

  const record = vi.fn().mockResolvedValue(undefined);
  const auditLogs = { record } as unknown as AuditLogService;

  const service = new ProviderCredentialsService(
    repository,
    dataSource,
    encryption,
    [googleTts, gemini],
    auditLogs,
  );

  return { service, repository, save, verify, verifyGemini, audit: record };
};

describe('ProviderCredentialsService.upload', () => {
  let context: ReturnType<typeof build>;

  beforeEach(() => {
    context = build();
  });

  it('lưu credential và chỉ trả về metadata đã che', async () => {
    const view = await context.service.upload(
      'google-tts',
      { file: serviceAccountFile },
      '127.0.0.1',
    );

    expect(view).toEqual({
      provider: 'google-tts',
      label: 'Google Cloud TTS',
      type: 'service_account',
      docsUrl: expect.any(String) as unknown as string,
      configured: true,
      displayHint: 'ree***@***.iam.gserviceaccount.com',
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
    await context.service.upload('google-tts', { file: serviceAccountFile }, null);

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

    await expect(
      context.service.upload('google-tts', { file: serviceAccountFile }, null),
    ).rejects.toMatchObject({ code: 'GOOGLE_TTS_AUTH_FAILED' });
    expect(context.save).not.toHaveBeenCalled();
  });

  it('file hỏng thì dừng trước khi gọi Google', async () => {
    await expect(
      context.service.upload('google-tts', { file: Buffer.from('{khong-phai-json', 'utf8') }, null),
    ).rejects.toMatchObject({ code: 'INVALID_SERVICE_ACCOUNT' });

    expect(context.verify).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
  });

  it('nhật ký kiểm toán không chứa bí mật', async () => {
    await context.service.upload('google-tts', { file: serviceAccountFile }, '127.0.0.1');

    const entry = JSON.stringify(context.audit.mock.calls[0]![0]);
    expect(entry).not.toContain('BEGIN PRIVATE KEY');
    expect(entry).not.toContain('reelforge-tts@reelforge-dev.iam.gserviceaccount.com');
    expect(entry).toContain('ree***@***.iam.gserviceaccount.com');
  });

  it('ghi database hỏng thì lỗi nổi lên, credential cũ không bị đụng', async () => {
    context.save.mockRejectedValueOnce(new Error('connection reset'));

    await expect(
      context.service.upload('google-tts', { file: serviceAccountFile }, null),
    ).rejects.toThrow('connection reset');
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

describe('ProviderCredentialsService — nhà cung cấp dùng API key', () => {
  /**
   * Khoá đời mới của Google AI Studio (*auth key*) bắt đầu bằng `AQ.Ab`, khác hẳn khoá cũ
   * `AIza`. Từ 28/05/2026 mọi khoá tạo mới đều theo dạng này, nên **cả hai đời đều phải
   * nhận được** — validator không khoá theo tiền tố.
   */
  const KEY = 'AQ.Ab8RN6J1234567890abcdefghijklmnopqrstu';

  it('lưu khoá dưới dạng ciphertext và chỉ trả về gợi ý đã che', async () => {
    const context = build();

    const view = await context.service.upload('google-gemini', { value: `  ${KEY}  ` }, null);

    expect(view).toMatchObject({
      provider: 'google-gemini',
      type: 'api_key',
      configured: true,
      displayHint: 'AQ.A…rstu',
      projectId: null,
      clientEmailMasked: null,
    });
    expect(JSON.stringify(view)).not.toContain(KEY);

    const saved = context.save.mock.calls[0]![0];
    expect(saved.credentialType).toBe('api_key');
    expect(saved.encryptedPayload.toString('utf8')).not.toContain(KEY);
    expect(JSON.stringify(context.audit.mock.calls[0]![0])).not.toContain(KEY);
  });

  it('vẫn nhận khoá đời cũ bắt đầu bằng AIza', async () => {
    const context = build();

    const view = await context.service.upload(
      'google-gemini',
      { value: 'AIzaSyB1234567890abcdefghijklmnopqrstu' },
      null,
    );

    expect(view.displayHint).toBe('AIza…rstu');
  });

  it.each([
    ['dán nhầm cả câu', 'khoá của tôi là AQ.Ab8RN6J1234567890abcdefghij'],
    ['dính xuống dòng', 'AQ.Ab8RN6J1234567890abcdefghij\nAQ.Ab'],
    ['quá ngắn', 'AQ.Ab123'],
    ['dán nhầm JSON service account', '{"type":"service_account","project_id":"x"}'],
  ])('chặn %s trước khi gọi nhà cung cấp', async (_label, value) => {
    const context = build();

    await expect(
      context.service.upload('google-gemini', { value }, null),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect(context.verifyGemini).not.toHaveBeenCalled();
    expect(context.save).not.toHaveBeenCalled();
  });

  it('thiếu khoá cũng bị từ chối, không ghi gì', async () => {
    const context = build();

    await expect(
      context.service.upload('google-gemini', {}, null),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(context.save).not.toHaveBeenCalled();
  });

  it('mã provider lạ thì báo không tìm thấy', async () => {
    const context = build();

    await expect(
      context.service.upload('nha-cung-cap-ma', { value: KEY }, null),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('liệt kê đủ nhà cung cấp kèm trạng thái chưa cấu hình', async () => {
    const { service } = build();

    const items = await service.listStatuses();

    expect(items.map((item) => item.provider)).toEqual(['google-tts', 'google-gemini']);
    expect(items.every((item) => !item.configured)).toBe(true);
  });
});
