import { describe, expect, it } from 'vitest';
import type { Repository } from 'typeorm';
import type { MediaAsset } from '../media/media-asset.entity.js';
import { Project, type ProjectLine } from './project.entity.js';
import { ProjectsService } from './projects.service.js';

/**
 * Bố cục theo khổ và khung cắt ảnh, kiểm ở tầng service.
 *
 * Dùng kho dữ liệu giả thay vì chạm cơ sở dữ liệu thật: những luật ở đây là luật của
 * service — cái gì được nhận, cái gì bị từ chối, cái gì phải sống sót qua một lần ghi đè —
 * và chúng không phụ thuộc vào Postgres.
 */

const line = (index: number, extra: Partial<ProjectLine> = {}): ProjectLine => ({
  index,
  text: `Câu thoại số ${index + 1}`,
  role: 'usp',
  assetId: null,
  emphasis: [],
  durationMs: 5000,
  voiceClipId: null,
  ...extra,
});

const makeProject = (lines: ProjectLine[]): Project => {
  const project = new Project();
  project.id = '11111111-1111-4111-8111-111111111111';
  project.userId = '22222222-2222-4222-8222-222222222222';
  project.aspectRatio = '9:16';
  project.subtitleStyle = {};
  project.frameLayouts = {};
  project.lines = lines;
  return project;
};

/** Kho giả: trả đúng dự án đang kiểm, và `save` trả lại thứ vừa ghi. */
const makeService = (project: Project) => {
  const projects = {
    findOne: () => Promise.resolve(project),
    save: (value: Project) => Promise.resolve(value),
  } as unknown as Repository<Project>;

  const assets = {
    findOne: () => Promise.resolve(null),
  } as unknown as Repository<MediaAsset>;

  return new ProjectsService(projects, assets);
};

const ID = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

describe('bố cục theo từng khổ', () => {
  it('lưu bố cục của một khổ mà không đụng khổ khác', async () => {
    const project = makeProject([line(0)]);
    project.frameLayouts = { '16:9': { subtitleY: 0.6, fontScale: null } };

    const saved = await makeService(project).update(ID, USER, {
      frameLayouts: {
        '16:9': { subtitleY: 0.6, fontScale: null },
        '9:16': { subtitleY: 0.42, fontScale: 0.06 },
      },
    });

    expect(saved.frameLayouts['9:16']).toEqual({ subtitleY: 0.42, fontScale: 0.06 });
    expect(saved.frameLayouts['16:9']).toEqual({ subtitleY: 0.6, fontScale: null });
  });

  it('từ chối giá trị ngoài khoảng thay vì để lỗi nổ lúc xuất video', async () => {
    const service = makeService(makeProject([line(0)]));

    await expect(
      service.update(ID, USER, { frameLayouts: { '9:16': { subtitleY: 5 } } }),
    ).rejects.toThrow();

    await expect(
      service.update(ID, USER, { frameLayouts: { '4:3': { subtitleY: 0.5 } } }),
    ).rejects.toThrow();
  });
});

describe('khung cắt ảnh của một cảnh', () => {
  it('lưu riêng cho từng khổ', async () => {
    const project = makeProject([line(0), line(1)]);

    const saved = await makeService(project).updateLine(ID, USER, 0, {
      crop: { '9:16': { x: 0.3, y: 0.7, zoom: 1.4 } },
    });

    expect(saved.lines[0]!.crop).toEqual({ '9:16': { x: 0.3, y: 0.7, zoom: 1.4 } });
    expect(saved.lines[1]!.crop).toBeUndefined();
  });

  it('từ chối mức phóng vô lý', async () => {
    const service = makeService(makeProject([line(0)]));

    await expect(
      service.updateLine(ID, USER, 0, { crop: { '9:16': { x: 0.5, y: 0.5, zoom: 12 } } }),
    ).rejects.toThrow();
  });

  /**
   * Bài quan trọng nhất trong tệp này.
   *
   * Hoàn tác đi qua `replaceLines`, và hàm đó dựng lại từng cảnh từ đầu chứ không vá lên
   * cảnh cũ. Quên một trường ở đó nghĩa là mỗi lần bấm Hoàn tác là xoá sạch công cắt ảnh
   * của người dùng — mất im lặng, không báo lỗi gì.
   */
  it('sống sót qua một lần hoàn tác', async () => {
    const crop = { '9:16': { x: 0.2, y: 0.8, zoom: 1.6 } };
    const project = makeProject([line(0, { crop }), line(1)]);

    const saved = await makeService(project).replaceLines(ID, USER, project.lines);

    expect(saved.lines[0]!.crop).toEqual(crop);
  });

  it('nhân bản cảnh thì hai cảnh không dùng chung một khung', async () => {
    const project = makeProject([line(0, { crop: { '9:16': { x: 0.2, y: 0.8, zoom: 1.6 } } })]);

    const saved = await makeService(project).duplicateLine(ID, USER, 0);

    expect(saved.lines[1]!.crop).toEqual(saved.lines[0]!.crop);
    expect(saved.lines[1]!.crop).not.toBe(saved.lines[0]!.crop);
  });
});
