import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { DAILY_TTS_LINES, SCENE_PADDING_MS, TtsService } from './tts.service.js';

/** WAV 24kHz mono 16-bit dài đúng 2 giây. */
const wav = (seconds: number): Buffer => {
  const dataBytes = 24_000 * 2 * seconds;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24_000, 24);
  buffer.writeUInt32LE(48_000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
};

const VOICE = {
  id: 'voice-1',
  providerVoiceId: 'vi-VN-Chirp3-HD-Achernar',
  modelId: 'google-chirp3',
  enabled: true,
};

const MODEL_CONFIG = {
  apiEndpoint: '',
  apiVersion: 'v1' as const,
  maxCharsPerRequest: 5000,
  audioEncoding: 'MP3' as const,
  defaultSpeakingRate: 1,
  defaultPitch: 0,
  dailyCharLimit: 0,
  monthlyCharLimit: 0,
};

const build = (overrides: {
  cachedClip?: unknown;
  quotaLines?: number;
  plan?: string;
} = {}) => {
  const saved: Record<string, unknown>[] = [];

  const clips = {
    findOne: vi.fn().mockResolvedValue(overrides.cachedClip ?? null),
    find: vi.fn().mockResolvedValue([]),
    save: vi.fn(async (clip: Record<string, unknown>) => {
      saved.push(clip);
      return { ...clip, id: `clip-${saved.length}` };
    }),
  };

  const quotas = {
    findOne: vi
      .fn()
      .mockResolvedValue(
        overrides.quotaLines === undefined ? null : { lines: overrides.quotaLines },
      ),
    query: vi.fn().mockResolvedValue(undefined),
  };

  const synthesis = {
    synthesize: vi.fn().mockResolvedValue({
      audioBase64: wav(2).toString('base64'),
      mimeType: 'audio/wav',
      apiVersion: 'v1',
      charCount: 42,
      latencyMs: 100,
    }),
  };

  const storage = { put: vi.fn().mockResolvedValue(undefined), signedUrl: vi.fn() };
  const usage = {
    assertWithinLimits: vi.fn().mockResolvedValue(undefined),
    record: vi.fn().mockResolvedValue(undefined),
  };

  const service = new TtsService(
    clips as never,
    quotas as never,
    { findOne: vi.fn().mockResolvedValue(VOICE) } as never,
    { findOne: vi.fn().mockResolvedValue({ id: VOICE.modelId, config: MODEL_CONFIG }) } as never,
    {
      findOne: vi.fn().mockResolvedValue({ id: 'user-1', plan: overrides.plan ?? 'free' }),
    } as never,
    { loadAccount: vi.fn().mockResolvedValue({ account: {} }) } as never,
    synthesis as never,
    usage as never,
    storage as never,
  );

  return { service, clips, quotas, synthesis, storage, usage, saved };
};

const LINE = { index: 0, text: 'Mình đã dùng sản phẩm này được hai tuần rồi.' };

describe('TtsService.synthesizeLines', () => {
  beforeEach(() => vi.clearAllMocks());

  it('đo thời lượng từ audio và cộng khoảng lặng giữa hai cảnh', async () => {
    const { service } = build();

    const [result] = await service.synthesizeLines('user-1', VOICE.id, 1, [LINE]);

    expect(result?.durationMs).toBe(2000 + SCENE_PADDING_MS);
    expect(result?.cached).toBe(false);
  });

  /** Đây là cơ chế tiết kiệm chi phí lớn nhất của sản phẩm — mất nó là mất tiền thật. */
  it('không gọi Google khi câu đã có trong cache', async () => {
    const { service, synthesis, storage } = build({
      cachedClip: {
        id: 'clip-cu',
        durationMs: 3200,
        contentHash: 'x',
        lastUsedAt: new Date(),
      },
    });

    const [result] = await service.synthesizeLines('user-1', VOICE.id, 1, [LINE]);

    expect(synthesis.synthesize).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ clipId: 'clip-cu', cached: true });
  });

  it('luôn gửi LINEAR16 dù model cấu hình MP3, vì cần đo thời lượng thật', async () => {
    const { service, synthesis } = build();

    await service.synthesizeLines('user-1', VOICE.id, 1, [LINE]);

    expect(synthesis.synthesize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        options: expect.objectContaining({ audioEncoding: 'LINEAR16' }),
      }),
    );
  });

  /** Tốc độ phải đi vào audio, không để trình duyệt áp — `playbackRate` không vào file MP4. */
  it('gửi tốc độ đọc sang nhà cung cấp', async () => {
    const { service, synthesis } = build();

    await service.synthesizeLines('user-1', VOICE.id, 1.25, [LINE]);

    expect(synthesis.synthesize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ speakingRate: 1.25 }),
    );
  });

  it('chặn khi tài khoản đã chạm trần trong ngày, trước khi gọi nhà cung cấp', async () => {
    const { service, synthesis } = build({ quotaLines: DAILY_TTS_LINES.free });

    await expect(
      service.synthesizeLines('user-1', VOICE.id, 1, [LINE]),
    ).rejects.toThrow(BusinessException);

    expect(synthesis.synthesize).not.toHaveBeenCalled();
  });

  it('gói premium không bị chặn theo ngày', async () => {
    const { service, synthesis } = build({ plan: 'premium', quotaLines: 99_999 });

    await service.synthesizeLines('user-1', VOICE.id, 1, [LINE]);

    expect(synthesis.synthesize).toHaveBeenCalledOnce();
  });

  it('từ chối tốc độ ngoài khoảng 0.8x–1.5x', async () => {
    const { service } = build();

    await expect(
      service.synthesizeLines('user-1', VOICE.id, 2, [LINE]),
    ).rejects.toThrow(BusinessException);
  });

  it('từ chối câu rỗng thay vì gửi một request vô nghĩa tốn tiền', async () => {
    const { service, synthesis } = build();

    await expect(
      service.synthesizeLines('user-1', VOICE.id, 1, [{ index: 0, text: '   ' }]),
    ).rejects.toThrow(BusinessException);

    expect(synthesis.synthesize).not.toHaveBeenCalled();
  });
});
