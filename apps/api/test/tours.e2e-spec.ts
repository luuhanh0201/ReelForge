import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { DEFAULT_STUDIO_TOUR, type Tour } from '@repo/shared';
import { AppModule } from './../src/app.module.js';
import { BusinessException } from './../src/common/exceptions/business.exception.js';
import { TourVersion } from './../src/tours/tour.entity.js';
import { ToursService } from './../src/tours/tours.service.js';
import { UserTourState } from './../src/tours/user-tour-state.entity.js';

/**
 * Tour hướng dẫn chạy trên database thật.
 *
 * Hai thứ đáng kiểm nhất ở đây đều không thể kiểm bằng repository giả: **thống kê rơi rớt**
 * gộp bằng SQL, và **ràng buộc mỗi người một dòng cho mỗi tour**.
 */
const KEY = 'studio';

/**
 * Mỗi bài kiểm tra dùng bộ tài khoản riêng.
 *
 * Dùng chung thì bài sau thừa hưởng dòng do bài trước tạo, và một thay đổi vô hại ở bài
 * này làm hỏng bài kia — đúng loại lỗi mất thời gian nhất để truy.
 */
const SINGLE_ROW_USER = '11111111-1111-4111-8111-111111111111';

const STATS_USERS = [
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
];

const userIds = [SINGLE_ROW_USER, ...STATS_USERS];

const sampleTour = (steps: Tour['steps']): Tour => ({
  key: KEY,
  label: 'Tour kiểm thử',
  enabled: true,
  autoStart: true,
  steps,
});

describe('ToursService (e2e)', () => {
  let app: INestApplication<App>;
  let tours: ToursService;
  let versions: Repository<TourVersion>;
  let states: Repository<UserTourState>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tours = moduleFixture.get(ToursService);
    versions = moduleFixture.get(getRepositoryToken(TourVersion));
    states = moduleFixture.get(getRepositoryToken(UserTourState));

    // Bắt đầu từ trạng thái sạch: các bài dưới đây phụ thuộc vào việc chưa có bản nào.
    await versions.delete({ key: KEY });
    for (const userId of userIds) await states.delete({ userId });
  });

  afterAll(async () => {
    await versions.delete({ key: KEY });
    for (const userId of userIds) await states.delete({ userId });
    await app.close();
  });

  it('trả bản mặc định trong mã nguồn khi chưa ai xuất bản', async () => {
    const tour = await tours.current(KEY);

    expect(tour.key).toBe(KEY);
    expect(tour.steps).toHaveLength(DEFAULT_STUDIO_TOUR.steps.length);
  });

  it('mọi bước của bản mặc định đều trỏ vào neo có thật', async () => {
    // Đây là hàng rào chống việc đổi bố cục giao diện mà quên sửa tour đi kèm.
    const { broken } = await tours.publish(
      KEY,
      DEFAULT_STUDIO_TOUR,
      'e2e@reelforge.test',
      'bản mặc định',
    );

    expect(broken).toEqual([]);
  });

  it('vẫn xuất bản được nhưng báo rõ bước trỏ vào neo không tồn tại', async () => {
    const { broken } = await tours.publish(
      KEY,
      sampleTour([
        {
          id: 'hong',
          anchor: 'studio.khong-ton-tai',
          title: 'Bước hỏng',
          body: 'Neo này đã bị gỡ khỏi giao diện.',
          placement: 'auto',
          prepare: null,
        },
      ]),
      'e2e@reelforge.test',
      null,
    );

    expect(broken).toHaveLength(1);
    expect(broken[0]?.stepId).toBe('hong');
  });

  it('từ chối khi hai bước trùng mã, vì thống kê gộp theo mã', async () => {
    const step = {
      anchor: 'studio.stage',
      title: 'Trùng',
      body: 'Hai bước cùng mã sẽ gộp nhầm số liệu.',
      placement: 'auto' as const,
      prepare: null,
    };

    await expect(
      tours.publish(
        KEY,
        sampleTour([
          { id: 'trung', ...step },
          { id: 'trung', ...step },
        ]),
        'e2e@reelforge.test',
        null,
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('giữ lịch sử để quay lại bản trước', async () => {
    const history = await tours.history(KEY);

    expect(history.length).toBeGreaterThanOrEqual(2);
    // Mới nhất đứng đầu.
    expect(history[0]!.publishedAt.getTime()).toBeGreaterThanOrEqual(
      history[1]!.publishedAt.getTime(),
    );
  });

  it('mỗi người chỉ có một dòng cho mỗi tour, ghi lại là cập nhật', async () => {
    await tours.saveState(SINGLE_ROW_USER, KEY, 'running', 'scenes');
    await tours.saveState(SINGLE_ROW_USER, KEY, 'running', 'voice');

    const rows = await states.find({ where: { userId: SINGLE_ROW_USER, tourKey: KEY } });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastStepId).toBe('voice');
  });

  it('thống kê đếm người bỏ dở theo từng bước, bỏ qua người đã đi hết', async () => {
    /*
     * Đo **chênh lệch** chứ không phải con số tuyệt đối.
     *
     * Bảng này dùng chung cho mọi người, và trên máy phát triển thường đã có sẵn vài dòng
     * thật. Một bài kiểm tra đòi hỏi bảng trống sẽ hỏng theo cách không liên quan gì tới
     * thứ nó đang kiểm.
     */
    const before = await tours.stats(KEY);
    const dropBefore = new Map(before.dropOff.map((item) => [item.stepId, item.count]));

    await tours.saveState(STATS_USERS[0]!, KEY, 'skipped', 'voice');
    await tours.saveState(STATS_USERS[1]!, KEY, 'skipped', 'voice');
    await tours.saveState(STATS_USERS[2]!, KEY, 'done', 'export');

    const after = await tours.stats(KEY);
    const dropAfter = new Map(after.dropOff.map((item) => [item.stepId, item.count]));

    expect(after.started - before.started).toBe(3);
    expect(after.completed - before.completed).toBe(1);
    expect(after.skipped - before.skipped).toBe(2);

    // Người đi hết không nói gì về chỗ khó hiểu, nên không được nằm trong biểu đồ rơi rớt.
    expect((dropAfter.get('voice') ?? 0) - (dropBefore.get('voice') ?? 0)).toBe(2);
    expect((dropAfter.get('export') ?? 0) - (dropBefore.get('export') ?? 0)).toBe(0);
  });
});
