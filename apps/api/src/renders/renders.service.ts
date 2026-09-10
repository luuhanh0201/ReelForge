import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { CreditsService } from '../credits/credits.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { Render } from './render.entity.js';

/** Giá một lần xuất video. Phải khớp con số landing page đang quảng cáo. */
export const RENDER_COST_CREDITS = 1;

/**
 * Vòng đời một lần xuất video.
 *
 * **Credit trừ trước, hoàn lại khi hỏng** — không phải trừ sau khi có file.
 *
 * Kế hoạch ban đầu định trừ sau, nhưng việc dựng hình chạy trên máy khách: nếu chờ trình
 * duyệt báo "xong rồi" mới trừ, thì chỉ cần không gọi cái request đó là xuất video miễn
 * phí không giới hạn. Trừ trước thì trường hợp xấu nhất là người dùng mất một credit vì
 * tab bị đóng giữa chừng — và đó là trường hợp `refundStale` dọn được, còn chiều ngược lại
 * thì không có cách nào cứu.
 */
@Injectable()
export class RendersService {
  private readonly logger = new Logger(RendersService.name);

  constructor(
    @InjectRepository(Render) private readonly renders: Repository<Render>,
    private readonly credits: CreditsService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Mở một lần xuất và giữ chỗ credit.
   *
   * Cấu hình render do **máy chủ dựng lại từ dự án**, không nhận từ trình duyệt: nhận vào
   * thì ai cũng có thể gửi một config 5 giây để trả giá của một video 60 giây, hoặc trỏ
   * `assetUrl` sang tài nguyên của người khác.
   */
  async start(
    userId: string,
    projectId: string,
    config: Record<string, unknown>,
    ip: string | null,
  ): Promise<{ renderId: string; balance: number }> {
    // Ném NOT_FOUND nếu dự án không thuộc người này — chặn trước khi đụng tới số dư.
    await this.projects.detail(projectId, userId);

    const running = await this.renders.count({
      where: { userId, status: 'running' },
    });

    // Một người dựng nhiều video cùng lúc là dấu hiệu của kịch bản tự động, không phải
    // thao tác thật: một tab chỉ encode được một video tại một thời điểm.
    if (running >= 3) {
      throw new BusinessException('TOO_MANY_REQUESTS', {
        message:
          'Bạn đang có 3 lần xuất chưa kết thúc. Hãy đợi chúng xong hoặc tải lại trang.',
      });
    }

    const render = new Render();
    render.userId = userId;
    render.projectId = projectId;
    render.status = 'running';
    render.renderConfig = config;
    render.creditsCharged = 0;
    render.failureReason = null;
    const saved = await this.renders.save(render);

    const result = await this.credits.apply({
      userId,
      amount: -RENDER_COST_CREDITS,
      type: 'render_charge',
      // Cặp ref chống trừ hai lần nếu request được gửi lại.
      refType: 'render',
      refId: saved.id,
      note: 'Xuất video MP4',
      ip,
    });

    saved.creditsCharged = RENDER_COST_CREDITS;
    await this.renders.save(saved);

    return { renderId: saved.id, balance: result.balance };
  }

  /** Trình duyệt báo đã có file hoàn chỉnh. */
  async complete(
    userId: string,
    renderId: string,
    fileSize: number,
    durationMs: number,
  ): Promise<Render> {
    const render = await this.findOwned(renderId, userId);

    if (render.status !== 'running') return render;

    render.status = 'done';
    render.fileSize = Math.max(0, Math.round(fileSize));
    render.durationMs = Math.max(0, Math.round(durationMs));

    return this.renders.save(render);
  }

  /**
   * Trình duyệt báo hỏng, hoặc người dùng huỷ giữa chừng.
   *
   * Hoàn credit là điều bắt buộc: người dùng không nhận được file thì không được mất tiền,
   * kể cả khi lỗi nằm ở máy của họ.
   */
  async fail(
    userId: string,
    renderId: string,
    reason: string,
    ip: string | null,
  ): Promise<{ balance: number | null }> {
    const render = await this.findOwned(renderId, userId);

    if (render.status !== 'running') return { balance: null };

    render.status = 'failed';
    render.failureReason = reason.slice(0, 500);

    let balance: number | null = null;

    if (render.creditsCharged > 0) {
      const result = await this.credits.apply({
        userId,
        amount: render.creditsCharged,
        type: 'refund',
        refType: 'render_refund',
        refId: render.id,
        note: 'Hoàn credit do xuất video thất bại',
        ip,
      });
      balance = result.balance;
      render.creditsCharged = 0;
    }

    await this.renders.save(render);

    return { balance };
  }

  async list(userId: string, limit = 20): Promise<Render[]> {
    return this.renders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async findOwned(id: string, userId: string): Promise<Render> {
    const render = await this.renders.findOne({ where: { id, userId } });

    if (!render) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy lần xuất video này',
      });
    }

    return render;
  }
}
