import { beforeEach, describe, expect, it, vi } from 'vitest';

const listVoices = vi.fn();
const close = vi.fn().mockResolvedValue(undefined);

// Mock SDK của Google: test không bao giờ gọi mạng thật.
vi.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: class {
    listVoices = listVoices;
    close = close;
  },
}));

const { GoogleTtsCredentialVerifierService } = await import(
  './google-tts-credential-verifier.service.js'
);
const { BusinessException } = await import('../common/exceptions/business.exception.js');

const account = {
  type: 'service_account' as const,
  project_id: 'reelforge-dev',
  private_key_id: 'a91f',
  private_key: 'pem',
  client_email: 'bot@reelforge-dev.iam.gserviceaccount.com',
};

const expectCode = async (thrown: unknown, code: string) => {
  const service = new GoogleTtsCredentialVerifierService();
  listVoices.mockRejectedValueOnce(thrown);

  await expect(service.verify(account)).rejects.toMatchObject({ code });
  expect(close).toHaveBeenCalled();
};

describe('GoogleTtsCredentialVerifierService', () => {
  beforeEach(() => {
    listVoices.mockReset();
    close.mockClear();
    listVoices.mockResolvedValue([{ voices: [{ name: 'vi-VN-Standard-A' }] }]);
  });

  it('trả latency và số voice khi thành công', async () => {
    const service = new GoogleTtsCredentialVerifierService();
    const result = await service.verify(account);

    expect(result.voiceCount).toBe(1);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('luôn đóng client kể cả khi lỗi', async () => {
    const service = new GoogleTtsCredentialVerifierService();
    listVoices.mockRejectedValueOnce(new Error('bất kỳ lỗi gì'));

    await expect(service.verify(account)).rejects.toBeInstanceOf(BusinessException);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('map lỗi xác thực', async () => {
    await expectCode(
      Object.assign(new Error('invalid_grant: Invalid JWT Signature'), { code: 16 }),
      'GOOGLE_TTS_AUTH_FAILED',
    );
  });

  it('map lỗi thiếu quyền', async () => {
    await expectCode(
      Object.assign(new Error('Permission denied on resource'), { code: 7 }),
      'GOOGLE_TTS_PERMISSION_DENIED',
    );
  });

  it('tách riêng trường hợp API chưa bật', async () => {
    await expectCode(
      Object.assign(
        new Error(
          'Cloud Text-to-Speech API has not been used in project 123 before or it is disabled',
        ),
        { code: 7 },
      ),
      'GOOGLE_TTS_API_DISABLED',
    );
  });

  it('map lỗi quá hạn chờ', async () => {
    await expectCode(
      Object.assign(new Error('Deadline exceeded'), { code: 4 }),
      'GOOGLE_TTS_TIMEOUT',
    );
  });

  it('không để lộ nguyên văn lỗi Google ra ngoài', async () => {
    const service = new GoogleTtsCredentialVerifierService();
    const raw = 'invalid_grant: JWT Signature cua bot@project.iam.gserviceaccount.com';
    listVoices.mockRejectedValueOnce(Object.assign(new Error(raw), { code: 16 }));

    await service.verify(account).catch((error: unknown) => {
      const exception = error as InstanceType<typeof BusinessException>;
      expect(exception.message).not.toContain(raw);
      expect(exception.details).toBeUndefined();
    });
  });
});
