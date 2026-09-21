import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { AuditLogService } from '../audit/audit-log.service.js';
import type { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service.js';
import type { TtsUsageService } from '../tts-usage/tts-usage.service.js';
import type { Voice } from '../voices/voice.entity.js';
import { AiModel } from './ai-model.entity.js';
import { AiModelsService } from './ai-models.service.js';

/**
 * `usedByVoices` là câu trả lời cho "model nào đang thật sự chạy".
 *
 * Trước đây giao diện chỉ có nhãn `badge` do người nhập tự gõ ("Default Primary"), nên một
 * model có thể trông như đang gánh cả hệ thống trong khi không giọng nào trỏ tới nó.
 */

const model = (id: string, kind: 'voice' | 'script' = 'voice'): AiModel =>
  ({
    id,
    kind,
    name: id,
    vendor: 'Google',
    enabled: true,
    badge: 'Default Primary',
    latency: '~1s',
    capability: 'Tiếng Việt',
    config: {},
    costAmount: '0',
    costUnit: 'per_million_chars',
    freeTierAmount: null,
    comingSoon: false,
    credentialProvider: null,
    verifiedAt: null,
    verificationNote: null,
    lastLatencyMs: null,
  }) as unknown as AiModel;

const build = (models: AiModel[], usage: { modelId: string; total: string }[]) => {
  const repository = {
    find: vi.fn().mockResolvedValue(models),
  } as unknown as Repository<AiModel>;

  const where = vi.fn().mockReturnThis();
  const voices = {
    createQueryBuilder: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where,
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue(usage),
    })),
  } as unknown as Repository<Voice>;

  const service = new AiModelsService(
    repository,
    voices,
    {} as ProviderCredentialsService,
    {} as TtsUsageService,
    {} as AuditLogService,
  );

  return { service, where };
};

describe('AiModelsService.list · usedByVoices', () => {
  it('đếm giọng đang dùng từng model', async () => {
    const { service } = build(
      [model('google-chirp3'), model('elevenlabs-turbo')],
      [{ modelId: 'google-chirp3', total: '40' }],
    );

    const items = await service.list();

    expect(items.find((item) => item.id === 'google-chirp3')?.usedByVoices).toBe(40);
    expect(items.find((item) => item.id === 'elevenlabs-turbo')?.usedByVoices).toBe(0);
  });

  it('chỉ tính giọng đang bật', async () => {
    const { service, where } = build([model('google-chirp3')], []);

    await service.list();

    expect(where).toHaveBeenCalledWith('voice.enabled = true');
  });

  it('model kịch bản chưa nối vào sản phẩm nên luôn là 0', async () => {
    const { service } = build([model('gemini-flash', 'script')], [
      { modelId: 'google-chirp3', total: '40' },
    ]);

    const [item] = await service.list('script');

    expect(item?.usedByVoices).toBe(0);
  });
});
