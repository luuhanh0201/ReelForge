import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DEFAULT_STUDIO_TOUR,
  TourSchema,
  TOUR_SCOPES,
  findTourScope,
  findBrokenSteps,
  type Tour,
} from '@repo/shared';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { TourVersion } from './tour.entity.js';
import { UserTourState, type TourStatus } from './user-tour-state.entity.js';

const STATUSES: readonly TourStatus[] = ['running', 'done', 'skipped'];

export interface TourStats {
  key: string;
  started: number;
  completed: number;
  skipped: number;
  /** Số người dừng lại ở từng bước — cột nào cao bất thường là bước cần viết lại. */
  dropOff: { stepId: string; count: number }[];
}

/**
 * Tour hướng dẫn.
 *
 * Nội dung do quản trị viên soạn, nhưng **neo và hành động thì do mã nguồn khai báo**
 * (`TOUR_SCOPES`). Mọi lần lưu đều kiểm tra lại hai thứ đó: một tour trỏ vào neo không tồn
 * tại sẽ treo giữa chừng ở phía người dùng, mà không có gì báo lỗi lúc biên dịch.
 */
@Injectable()
export class ToursService {
  private readonly logger = new Logger(ToursService.name);

  constructor(
    @InjectRepository(TourVersion)
    private readonly versions: Repository<TourVersion>,
    @InjectRepository(UserTourState)
    private readonly states: Repository<UserTourState>,
  ) {}

  /** Danh mục neo và hành động để trang quản trị dựng dropdown, không cho gõ tự do. */
  registry() {
    return { scopes: TOUR_SCOPES };
  }

  /**
   * Bản đang chạy của một tour.
   *
   * Chưa xuất bản lần nào thì trả bản mặc định trong mã nguồn — người dùng mới vẫn có
   * hướng dẫn ngay từ ngày đầu, không phải chờ ai đó vào trang quản trị bấm lưu.
   */
  async current(key: string): Promise<Tour> {
    const latest = await this.versions.findOne({
      where: { key },
      order: { publishedAt: 'DESC' },
    });

    if (!latest) {
      return key === DEFAULT_STUDIO_TOUR.key
        ? DEFAULT_STUDIO_TOUR
        : TourSchema.parse({ key, label: key, steps: [] });
    }

    const parsed = TourSchema.safeParse(latest.config);

    if (!parsed.success) {
      // Dữ liệu hỏng không được làm trắng phần hướng dẫn của người dùng.
      this.logger.error(
        `Tour "${key}" phiên bản ${latest.id} không đọc được: ${parsed.error.message}`,
      );
      return TourSchema.parse({ key, label: key, enabled: false, steps: [] });
    }

    return parsed.data;
  }

  async history(key: string, limit = 20): Promise<TourVersion[]> {
    return this.versions.find({
      where: { key },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  /** Xuất bản một phiên bản mới. Bản cũ giữ nguyên để quay lại được. */
  async publish(
    key: string,
    input: unknown,
    publishedBy: string,
    note: string | null,
  ): Promise<{ tour: Tour; broken: { stepId: string; reason: string }[] }> {
    const parsed = TourSchema.safeParse(input);

    if (!parsed.success) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Nội dung tour không hợp lệ',
        details: { issues: parsed.error.issues.slice(0, 5) },
      });
    }

    if (parsed.data.key !== key) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Khoá tour trong nội dung không khớp đường dẫn',
      });
    }

    const scope = findTourScope(key);
    if (!scope) {
      throw new BusinessException('NOT_FOUND', {
        message: `Khu vực "${key}" không có trong danh mục của mã nguồn`,
      });
    }

    // Id bước phải duy nhất: thống kê rơi rớt gộp theo id, trùng id là gộp nhầm hai bước.
    const ids = parsed.data.steps.map((step) => step.id);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Mỗi bước phải có mã riêng, hiện đang có mã trùng nhau',
      });
    }

    const broken = findBrokenSteps(parsed.data, scope);

    // Cảnh báo chứ không chặn: quản trị viên có thể đang soạn trước cho một neo sắp thêm.
    if (broken.length > 0) {
      this.logger.warn(
        `Tour "${key}" xuất bản với ${broken.length} bước trỏ vào neo/hành động không tồn tại`,
      );
    }

    const version = new TourVersion();
    version.key = key;
    version.config = parsed.data as unknown as Record<string, unknown>;
    version.publishedBy = publishedBy;
    version.note = note?.trim() || null;
    await this.versions.save(version);

    return { tour: parsed.data, broken };
  }

  /** Trạng thái của một người với một tour; `null` nghĩa là chưa từng thấy. */
  async stateFor(userId: string, key: string): Promise<UserTourState | null> {
    return this.states.findOne({ where: { userId, tourKey: key } });
  }

  async saveState(
    userId: string,
    key: string,
    status: TourStatus,
    lastStepId: string | null,
  ): Promise<UserTourState> {
    if (!STATUSES.includes(status)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Trạng thái tour không hợp lệ',
      });
    }

    const existing = await this.stateFor(userId, key);
    const state = existing ?? new UserTourState();

    state.userId = userId;
    state.tourKey = key;
    state.status = status;
    state.lastStepId = lastStepId?.slice(0, 60) ?? null;

    return this.states.save(state);
  }

  /**
   * Thống kê cho trang quản trị.
   *
   * Suy hết từ `user_tour_state`, không cần một bảng nhật ký riêng: mỗi người chỉ có một
   * dòng cho mỗi tour, nên đếm ở đây là đếm người chứ không phải đếm lượt.
   */
  async stats(key: string): Promise<TourStats> {
    const rows = await this.states
      .createQueryBuilder('state')
      .select('state.status', 'status')
      .addSelect('state.last_step_id', 'stepId')
      .addSelect('count(*)', 'count')
      .where('state.tour_key = :key', { key })
      .groupBy('state.status')
      .addGroupBy('state.last_step_id')
      .getRawMany<{ status: TourStatus; stepId: string | null; count: string }>();

    const dropOff = new Map<string, number>();
    let started = 0;
    let completed = 0;
    let skipped = 0;

    for (const row of rows) {
      const count = Number(row.count);
      started += count;

      if (row.status === 'done') completed += count;
      if (row.status === 'skipped') skipped += count;

      // Chỉ tính bỏ dở: người đi hết tour không nói gì về chỗ khó hiểu.
      if (row.status !== 'done' && row.stepId) {
        dropOff.set(row.stepId, (dropOff.get(row.stepId) ?? 0) + count);
      }
    }

    return {
      key,
      started,
      completed,
      skipped,
      dropOff: [...dropOff.entries()]
        .map(([stepId, count]) => ({ stepId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
