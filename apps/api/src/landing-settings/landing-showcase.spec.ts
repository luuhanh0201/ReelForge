import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { AuditLogService } from '../audit/audit-log.service.js';
import type { Voice } from '../voices/voice.entity.js';
import type { VoicePreview } from '../voices/voice-preview.entity.js';
import type { VoicesService } from '../voices/voices.service.js';
import { DEFAULT_LANDING_CONFIG } from './landing-config.default.js';
import type { LandingSetting } from './landing-setting.entity.js';
import { LandingSettingsService } from './landing-settings.service.js';

/**
 * Bốn thẻ nghe thử trên landing.
 *
 * Luật quan trọng nhất ở đây: **chỉ hiện giọng có bản nghe thử còn khớp câu thoại**. Sửa
 * câu thoại mà vẫn phát bản cũ thì khách đọc một đằng nghe một nẻo — đúng thứ mục này sinh
 * ra để tránh.
 */

const voice = (id: string, personaName: string): Voice =>
  ({
    id,
    personaName,
    gender: 'female',
    region: 'Giọng Bắc',
    sampleText: `Câu của ${personaName}`,
    enabled: true,
  }) as Voice;

const build = (options: { voices: Voice[]; ready: string[]; showcase?: string[] }) => {
  const config = {
    ...DEFAULT_LANDING_CONFIG,
    voice: { ...DEFAULT_LANDING_CONFIG.voice, showcase: options.showcase ?? [] },
  };

  const repository = {
    findOne: vi.fn().mockResolvedValue({ config, publishedAt: new Date(), publishedBy: null, note: null }),
  } as unknown as Repository<LandingSetting>;

  const previews = { findOne: vi.fn() } as unknown as Repository<VoicePreview>;

  const voices = {
    find: vi.fn().mockResolvedValue(options.voices),
  } as unknown as Repository<Voice>;

  const catalog = {
    previewReadyIds: vi.fn().mockResolvedValue(new Set(options.ready)),
  } as unknown as VoicesService;

  return new LandingSettingsService(
    repository,
    previews,
    voices,
    catalog,
    {} as AuditLogService,
  );
};

describe('LandingSettingsService.showcaseVoices', () => {
  const all = [voice('v1', 'Bảo Trân'), voice('v2', 'Bích Ngọc'), voice('v3', 'Anh Tuấn')];

  it('bỏ giọng có bản nghe thử đã cũ so với câu thoại', async () => {
    const service = build({ voices: all, ready: ['v1', 'v3'] });

    const items = await service.showcaseVoices();

    expect(items.map((item) => item.id)).toEqual(['v1', 'v3']);
  });

  it('theo đúng thứ tự admin chọn trong CMS', async () => {
    const service = build({ voices: all, ready: ['v1', 'v2', 'v3'], showcase: ['v3', 'v1'] });

    const items = await service.showcaseVoices();

    expect(items.map((item) => item.id)).toEqual(['v3', 'v1']);
  });

  it('CMS chọn giọng chưa sẵn sàng thì bỏ qua giọng đó, không để thẻ chết', async () => {
    const service = build({ voices: all, ready: ['v1'], showcase: ['v2', 'v1'] });

    const items = await service.showcaseVoices();

    expect(items.map((item) => item.id)).toEqual(['v1']);
  });

  it('trả câu thoại của chính giọng — đúng câu bản audio đọc', async () => {
    const service = build({ voices: all, ready: ['v1'] });

    const [item] = await service.showcaseVoices();

    expect(item?.sampleText).toBe('Câu của Bảo Trân');
  });

  it('chưa giọng nào sẵn sàng thì trả danh sách rỗng để landing dùng bản tĩnh', async () => {
    const service = build({ voices: all, ready: [] });

    expect(await service.showcaseVoices()).toEqual([]);
  });
});
