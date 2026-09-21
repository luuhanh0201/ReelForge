import { Inject, Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { CrawlerService } from '../crawler/crawler.service.js';
import { MediaService } from '../media/media.service.js';
import type { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { ProjectVoiceService, type VoiceClipView } from '../tts/project-voice.service.js';
import { VoicesService } from '../voices/voices.service.js';
import { durationForAssets } from './autobuild.config.js';
import { SCRIPT_PROVIDER, type ScriptProvider } from './script-provider.js';

export const AUTOBUILD_STEPS = ['import', 'script', 'assets', 'voice', 'speech'] as const;
export type AutobuildStep = (typeof AUTOBUILD_STEPS)[number];

/**
 * `skipped` — bước không cần chạy (đã có sẵn kết quả, hoặc không áp dụng cho dự án này).
 * `failed` — có chạy nhưng không xong; `detail` nói lý do bằng tiếng người.
 */
export type AutobuildStepStatus = 'done' | 'skipped' | 'failed';

export interface AutobuildStepReport {
  step: AutobuildStep;
  status: AutobuildStepStatus;
  detail: string;
  /**
   * Bước này đang chờ người dùng làm gì đó (tải ảnh lên, chọn giọng, chờ hết hạn mức).
   *
   * Giao diện cần biết điều này để quyết định có giữ bảng kết quả lại hay đóng luôn — và
   * đó là việc máy chủ phải nói thẳng, không phải để giao diện đoán qua câu chữ.
   */
  needsUser: boolean;
}

export interface AutobuildResult {
  project: Project;
  clips: VoiceClipView[];
  steps: AutobuildStepReport[];
}

export interface AutobuildInput {
  /** Ép viết lại kịch bản kể cả khi dự án đã có cảnh. */
  force?: boolean;
  templateCode?: string;
  durationSec?: number;
}

/**
 * Dựng sẵn một video từ đầu tới cuối để người dùng chỉ còn việc kiểm tra.
 *
 * Service này **không tự làm gì cả** — nó gọi lại đúng những thao tác người dùng vẫn bấm
 * tay: đọc link, chọn mẫu kịch bản, gán ảnh, chọn giọng, lồng tiếng. Giữ nó ở tầng điều
 * phối như vậy có hai cái lợi: thao tác tay và thao tác tự động không bao giờ lệch nhau,
 * và lúc thay bước viết kịch bản bằng LLM thì các bước còn lại không phải đụng tới.
 *
 * **Một bước hỏng không làm hỏng cả chuỗi.** Hết hạn mức lồng tiếng trong ngày vẫn phải trả
 * về dự án đã có kịch bản và ảnh — người dùng còn sửa tiếp được, chỉ là chưa có tiếng.
 * Vì thế mọi lỗi đều biến thành một dòng trong `steps`, trừ lỗi quyền và không tìm thấy.
 *
 * **Không tự xuất video**: xuất tốn credit và chạy trên máy người dùng, nên đó vẫn phải là
 * một cú bấm có chủ ý.
 */
@Injectable()
export class AutobuildService {
  private readonly logger = new Logger(AutobuildService.name);

  constructor(
    private readonly projects: ProjectsService,
    private readonly media: MediaService,
    private readonly crawler: CrawlerService,
    private readonly voices: VoicesService,
    private readonly voice: ProjectVoiceService,
    @Inject(SCRIPT_PROVIDER) private readonly script: ScriptProvider,
  ) {}

  async run(
    projectId: string,
    userId: string,
    input: AutobuildInput = {},
  ): Promise<AutobuildResult> {
    let project = await this.projects.detail(projectId, userId);
    const steps: AutobuildStepReport[] = [];

    const record = (
      step: AutobuildStep,
      status: AutobuildStepStatus,
      detail: string,
      needsUser = status === 'failed',
    ) => {
      steps.push({ step, status, detail, needsUser });
    };

    /** Lỗi của một bước chỉ là một dòng báo cáo; chuỗi vẫn đi tiếp với dữ liệu đang có. */
    const attempt = async (
      step: AutobuildStep,
      task: () => Promise<{ project?: Project; detail: string }>,
    ): Promise<boolean> => {
      try {
        const result = await task();
        if (result.project) project = result.project;
        record(step, 'done', result.detail);
        return true;
      } catch (error) {
        const detail =
          error instanceof BusinessException
            ? error.message
            : 'Có lỗi ngoài dự kiến, bạn làm tay bước này giúp nhé';

        this.logger.warn(
          `Bước ${step} của dự án ${projectId} hỏng: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        record(step, 'failed', detail);
        return false;
      }
    };

    // 1. Lấy thông tin sản phẩm. Dự án tự nhập, hoặc đã đọc rồi, thì không đụng tới link.
    if (project.mode !== 'link' || !project.sourceUrl) {
      record('import', 'skipped', 'Dự án dùng thông tin bạn tự nhập');
    } else if (project.product.name) {
      record('import', 'skipped', 'Đã có thông tin sản phẩm');
    } else {
      await attempt('import', async () => {
        const result = await this.crawler.importLink(projectId, userId, {});

        return {
          project: result.project,
          detail:
            result.crawl.status === 'failed'
              ? 'Sàn không trả dữ liệu, bạn điền tay giúp nhé'
              : `Đã đọc link · thêm ${result.importedImages} ảnh`,
        };
      });
    }

    // 2. Kịch bản. Chỗ này sẽ do LLM đảm nhận khi có key; các bước sau không cần biết.
    const assets = await this.media.listByProject(projectId);

    if (project.lines.length > 0 && !input.force) {
      record('script', 'skipped', 'Dự án đã có kịch bản');
    } else {
      await attempt('script', async () => {
        const durationSec = input.durationSec ?? durationForAssets(assets.length);
        const updated = await this.script.writeScript(project, userId, {
          durationSec,
          templateCode: input.templateCode,
        });

        return {
          project: updated,
          detail: `${updated.lines.length} cảnh · ${durationSec} giây`,
        };
      });
    }

    // 3. Ảnh cho từng cảnh.
    if (assets.length === 0) {
      record('assets', 'skipped', 'Chưa có ảnh nào, bạn tải ảnh sản phẩm lên nhé', true);
    } else if (project.lines.every((line) => line.assetId)) {
      record('assets', 'skipped', 'Mọi cảnh đã có hình');
    } else {
      await attempt('assets', async () => {
        const updated = await this.projects.assignAssetsInOrder(projectId, userId);
        const filled = updated.lines.filter((line) => line.assetId).length;

        return {
          project: updated,
          detail: `Đã gán hình cho ${filled}/${updated.lines.length} cảnh`,
        };
      });
    }

    // 4. Giọng đọc.
    if (project.voiceId) {
      record('voice', 'skipped', 'Bạn đã chọn giọng đọc');
    } else {
      await attempt('voice', async () => {
        const [first] = await this.voices.listEnabled();

        if (!first) {
          throw new BusinessException('NOT_FOUND', {
            message: 'Chưa có giọng đọc nào được bật, hãy liên hệ quản trị viên',
          });
        }

        return {
          project: await this.projects.setVoice(projectId, userId, first.id),
          detail: `Dùng giọng ${first.personaName}`,
        };
      });
    }

    // 5. Lồng tiếng — bước duy nhất tiêu hạn mức, nên chạy cuối cùng.
    if (project.lines.length === 0) {
      record('speech', 'skipped', 'Chưa có lời thoại để đọc', true);
    } else if (!project.voiceId) {
      record('speech', 'skipped', 'Chưa chọn được giọng đọc', true);
    } else if (project.lines.every((line) => line.voiceClipId)) {
      record('speech', 'skipped', 'Mọi cảnh đã có tiếng');
    } else {
      await attempt('speech', async () => {
        const result = await this.voice.synthesizeProject(project, userId);

        return {
          project: result.project,
          detail:
            result.synthesized > 0
              ? `Đã lồng tiếng ${result.project.lines.length} cảnh`
              : 'Đã lồng tiếng, lấy từ bộ nhớ đệm nên không tốn hạn mức',
        };
      });
    }

    return { project, clips: await this.voice.toViews(project), steps };
  }
}
