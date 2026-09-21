import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import type { MediaAsset } from '../media/media-asset.entity.js';
import { Project, type ProjectLine } from './project.entity.js';
import { ProjectsService } from './projects.service.js';

/** Rải ảnh vào cảnh — bước luồng dựng tự động gọi thay cho người dùng. */

const ID = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

const line = (index: number, extra: Partial<ProjectLine> = {}): ProjectLine => ({
  index,
  text: `Câu ${index}`,
  role: 'usp',
  assetId: null,
  emphasis: [],
  durationMs: 10_000,
  voiceClipId: null,
  ...extra,
});

const asset = (id: string, extra: Partial<MediaAsset> = {}): MediaAsset =>
  ({ id, kind: 'image', durationMs: null, ...extra }) as MediaAsset;

const makeService = (lines: ProjectLine[], assets: MediaAsset[]) => {
  const project = new Project();
  project.id = ID;
  project.userId = USER;
  project.lines = lines;

  const projects = {
    findOne: () => Promise.resolve(project),
    save: (value: Project) => Promise.resolve(value),
  } as unknown as Repository<Project>;

  const repository = {
    find: () => Promise.resolve(assets),
    findOne: () => Promise.resolve(null),
  } as unknown as Repository<MediaAsset>;

  return new ProjectsService(projects, repository);
};

describe('assignAssetsInOrder', () => {
  it('rải ảnh theo đúng thứ tự thư viện', async () => {
    const service = makeService(
      [line(0), line(1), line(2)],
      [asset('a1'), asset('a2'), asset('a3')],
    );

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines.map((item) => item.assetId)).toEqual(['a1', 'a2', 'a3']);
  });

  it('ít ảnh hơn số cảnh thì quay vòng, không để cảnh nào trống', async () => {
    const service = makeService([line(0), line(1), line(2), line(3)], [asset('a1'), asset('a2')]);

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines.map((item) => item.assetId)).toEqual(['a1', 'a2', 'a1', 'a2']);
  });

  it('không đụng cảnh người dùng đã tự gán ảnh', async () => {
    const service = makeService(
      [line(0, { assetId: 'tay' }), line(1), line(2)],
      [asset('a1'), asset('a2')],
    );

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines.map((item) => item.assetId)).toEqual(['tay', 'a1', 'a2']);
  });

  it('gán video thì thời lượng cảnh bám theo độ dài video', async () => {
    const service = makeService([line(0)], [asset('v1', { kind: 'video', durationMs: 6_400 })]);

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines[0]?.durationMs).toBe(6_400);
  });

  it('cảnh đã có tiếng thì giữ nguyên thời lượng của audio', async () => {
    const service = makeService(
      [line(0, { voiceClipId: 'clip', durationMs: 9_100 })],
      [asset('v1', { kind: 'video', durationMs: 6_400 })],
    );

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines[0]?.durationMs).toBe(9_100);
  });

  it('chưa có ảnh nào thì trả dự án nguyên vẹn', async () => {
    const service = makeService([line(0)], []);

    const saved = await service.assignAssetsInOrder(ID, USER);

    expect(saved.lines[0]?.assetId).toBeNull();
  });
});
