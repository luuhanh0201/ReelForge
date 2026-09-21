import { describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { CrawlerService } from '../crawler/crawler.service.js';
import type { MediaService } from '../media/media.service.js';
import type { Project, ProjectLine } from '../projects/project.entity.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { ProjectVoiceService } from '../tts/project-voice.service.js';
import type { VoicesService } from '../voices/voices.service.js';
import { AutobuildService, type AutobuildStep } from './autobuild.service.js';
import type { ScriptProvider } from './script-provider.js';

const line = (index: number, overrides: Partial<ProjectLine> = {}): ProjectLine => ({
  index,
  text: `Câu ${index}`,
  role: 'usp',
  assetId: null,
  emphasis: [],
  durationMs: 10_000,
  voiceClipId: null,
  ...overrides,
});

const build = (options: {
  project?: Partial<Project>;
  assets?: { id: string }[];
  voices?: { id: string; personaName: string }[];
  onSpeech?: () => Promise<never>;
  onImport?: () => Promise<never>;
} = {}) => {
  const project = {
    id: 'p1',
    mode: 'link',
    sourceUrl: 'https://shopee.vn/product/1/2',
    product: {},
    lines: [] as ProjectLine[],
    voiceId: null as string | null,
    voiceSpeed: 1,
    ...options.project,
  } as Project;

  const save = (patch: Partial<Project>): Project => Object.assign(project, patch);

  const projects = {
    detail: vi.fn(async () => project),
    applyTemplate: vi.fn(async () => save({ lines: [line(0), line(1), line(2)] })),
    assignAssetsInOrder: vi.fn(async () =>
      save({
        lines: project.lines.map((item, position) => ({
          ...item,
          assetId: item.assetId ?? `a${position % Math.max(options.assets?.length ?? 1, 1)}`,
        })),
      }),
    ),
    setVoice: vi.fn(async (_id: string, _user: string, voiceId: string) => save({ voiceId })),
  };

  const media = { listByProject: vi.fn(async () => options.assets ?? [{ id: 'a0' }]) };

  const crawler = {
    importLink: vi.fn(
      options.onImport ??
        (async () => ({
          project: save({ product: { name: 'Tai nghe K29' } }),
          crawl: { status: 'success', missingFields: [], at: '' },
          importedImages: 3,
        })),
    ),
  };

  const voices = {
    listEnabled: vi.fn(async () => options.voices ?? [{ id: 'v1', personaName: 'Bảo An' }]),
  };

  const voice = {
    synthesizeProject: vi.fn(
      options.onSpeech ??
        (async () => ({
          project: save({
            lines: project.lines.map((item) => ({ ...item, voiceClipId: `c${item.index}` })),
          }),
          clips: [],
          synthesized: 3,
          quota: { used: 3, limit: 30 },
        })),
    ),
    toViews: vi.fn(async () => []),
  };

  const script: ScriptProvider = {
    id: 'template',
    writeScript: vi.fn(async () => projects.applyTemplate()),
  };

  const service = new AutobuildService(
    projects as unknown as ProjectsService,
    media as unknown as MediaService,
    crawler as unknown as CrawlerService,
    voices as unknown as VoicesService,
    voice as unknown as ProjectVoiceService,
    script,
  );

  return { service, projects, media, crawler, voices, voice, script, project };
};

const statuses = (steps: { step: AutobuildStep; status: string }[]) =>
  Object.fromEntries(steps.map((item) => [item.step, item.status]));

describe('AutobuildService.run', () => {
  it('chạy đủ 5 bước theo đúng thứ tự cho dự án từ link', async () => {
    const { service, crawler, script, projects, voice } = build();

    const result = await service.run('p1', 'u1');

    expect(result.steps.map((item) => item.step)).toEqual([
      'import',
      'script',
      'assets',
      'voice',
      'speech',
    ]);
    expect(statuses(result.steps)).toEqual({
      import: 'done',
      script: 'done',
      assets: 'done',
      voice: 'done',
      speech: 'done',
    });
    expect(crawler.importLink).toHaveBeenCalled();
    expect(script.writeScript).toHaveBeenCalled();
    expect(projects.setVoice).toHaveBeenCalledWith('p1', 'u1', 'v1');
    expect(voice.synthesizeProject).toHaveBeenCalled();
  });

  it('bỏ qua bước đã có kết quả, không làm lại công của người dùng', async () => {
    const { service, crawler, script, projects } = build({
      project: {
        product: { name: 'Đã có' },
        lines: [line(0, { assetId: 'a9' })],
        voiceId: 'v-user',
      } as Partial<Project>,
    });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps)).toMatchObject({
      import: 'skipped',
      script: 'skipped',
      assets: 'skipped',
      voice: 'skipped',
    });
    expect(crawler.importLink).not.toHaveBeenCalled();
    expect(script.writeScript).not.toHaveBeenCalled();
    expect(projects.setVoice).not.toHaveBeenCalled();
  });

  it('dự án tự nhập thì không đụng tới bước đọc link', async () => {
    const { service, crawler } = build({
      project: { mode: 'manual', sourceUrl: null } as Partial<Project>,
    });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps).import).toBe('skipped');
    expect(crawler.importLink).not.toHaveBeenCalled();
  });

  it('hết hạn mức lồng tiếng vẫn trả về dự án đã có kịch bản và ảnh', async () => {
    const { service } = build({
      onSpeech: async () => {
        throw new BusinessException('TOO_MANY_REQUESTS', {
          message: 'Bạn đã dùng hết 30 câu lồng tiếng hôm nay',
        });
      },
    });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps)).toMatchObject({
      script: 'done',
      assets: 'done',
      speech: 'failed',
    });
    expect(result.steps.at(-1)?.detail).toContain('hết 30 câu');
    expect(result.project.lines).toHaveLength(3);
  });

  it('chưa có giọng nào được bật thì báo lý do và không lồng tiếng', async () => {
    const { service, voice } = build({ voices: [] });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps)).toMatchObject({ voice: 'failed', speech: 'skipped' });
    expect(result.steps.find((item) => item.step === 'voice')?.detail).toContain(
      'Chưa có giọng đọc nào được bật',
    );
    expect(voice.synthesizeProject).not.toHaveBeenCalled();
  });

  it('đọc link hỏng vẫn đi tiếp bằng mẫu kịch bản', async () => {
    const { service, script } = build({
      onImport: async () => {
        throw new Error('ECONNRESET');
      },
    });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps)).toMatchObject({ import: 'failed', script: 'done' });
    expect(script.writeScript).toHaveBeenCalled();
  });

  it('chưa có ảnh thì nói rõ, không dựng cảnh trống một cách im lặng', async () => {
    const { service, projects } = build({ assets: [] });

    const result = await service.run('p1', 'u1');

    expect(statuses(result.steps).assets).toBe('skipped');
    expect(result.steps.find((item) => item.step === 'assets')?.detail).toContain('tải ảnh');
    expect(projects.assignAssetsInOrder).not.toHaveBeenCalled();
  });

  it('đánh dấu bước nào đang chờ người dùng xử lý', async () => {
    const { service } = build({ assets: [], voices: [] });

    const result = await service.run('p1', 'u1');
    const flags = Object.fromEntries(
      result.steps.map((item) => [item.step, item.needsUser]),
    );

    // Đọc link xong xuôi và kịch bản viết xong thì không có gì để người dùng làm; còn
    // thiếu ảnh, thiếu giọng và vì thế chưa lồng tiếng được thì có.
    expect(flags).toEqual({
      import: false,
      script: false,
      assets: true,
      voice: true,
      speech: true,
    });
  });

  it('độ dài suy từ số ảnh, kẹp trong 30–60 giây', async () => {
    const many = build({ assets: Array.from({ length: 9 }, (_, i) => ({ id: `a${i}` })) });
    await many.service.run('p1', 'u1');
    expect(vi.mocked(many.script.writeScript).mock.calls[0]?.[2].durationSec).toBe(60);

    const few = build({ assets: [{ id: 'a0' }] });
    await few.service.run('p1', 'u1');
    expect(vi.mocked(few.script.writeScript).mock.calls[0]?.[2].durationSec).toBe(30);
  });
});
