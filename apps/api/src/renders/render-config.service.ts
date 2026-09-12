import { Injectable } from '@nestjs/common';
import { buildRenderConfig, type RenderConfig } from '@repo/shared';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { MediaService } from '../media/media.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TtsService } from '../tts/tts.service.js';

/**
 * Dựng cấu hình render trên **máy chủ**.
 *
 * Không nhận config do trình duyệt gửi lên, dù chính trình duyệt sẽ là nơi dựng hình. Lý
 * do: config là thứ được lưu lại làm bằng chứng cho một lần xuất — người dùng báo video
 * hỏng thì đây là cái duy nhất dựng lại được đúng khung hình đó. Một bản ghi mà nội dung
 * do phía được kiểm tra tự khai thì không dùng để đối chiếu được.
 *
 * Phép tính dùng chung với khung xem trước qua `buildRenderConfig` của `@repo/shared`, nên
 * hai bên không thể lệch nhau.
 */
@Injectable()
export class RenderConfigService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly media: MediaService,
    private readonly tts: TtsService,
  ) {}

  /**
   * @param variationSeed Bỏ trống khi chỉ xem trước; **lúc xuất thật phải truyền hạt giống
   * mới**, nếu không mọi lần xuất sẽ ra file giống hệt nhau và nền tảng phân phối coi đó
   * là nội dung trùng lặp.
   */
  async build(
    projectId: string,
    userId: string,
    variationSeed?: string,
  ): Promise<RenderConfig> {
    const project = await this.projects.detail(projectId, userId);

    if (project.lines.length === 0) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Dự án chưa có cảnh nào để xuất video',
      });
    }

    const assets = await this.media.listByProject(projectId);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const urls = new Map(
      await Promise.all(
        assets.map(
          async (asset) =>
            [
              asset.id,
              await this.media.signedVariantUrl(
                asset,
                project.aspectRatio,
                project.resolution,
              ),
            ] as const,
        ),
      ),
    );

    const missingImage = project.lines.filter(
      (line) => !line.assetId || !urls.has(line.assetId),
    );

    // Chặn ở đây thay vì để người dùng đợi hết quá trình encode rồi mới thấy khung đen.
    if (missingImage.length > 0) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Cảnh ${missingImage
          .map((line) => line.index + 1)
          .join(', ')} chưa có ảnh. Hãy gán ảnh trước khi xuất video.`,
      });
    }

    const clipIds = project.lines
      .map((line) => line.voiceClipId)
      .filter((value): value is string => Boolean(value));
    const clips = await this.tts.findClips(clipIds);

    const voiceClips = await Promise.all(
      project.lines.flatMap((line) => {
        const clip = line.voiceClipId ? clips.get(line.voiceClipId) : undefined;
        if (!clip) return [];

        return [
          this.tts.signedUrl(clip.id).then((url) => ({
            sceneIndex: line.index,
            url: url ?? '',
            durationMs: clip.durationMs,
          })),
        ];
      }),
    );

    const config = buildRenderConfig({
      projectId: project.id,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      subtitle: project.subtitleStyle,
      lines: project.lines.map((line) => {
        const asset = byId.get(line.assetId!)!;

        return {
          index: line.index,
          text: line.text,
          emphasis: line.emphasis,
          /*
           * Cảnh gắn video thì độ dài phải đủ chứa cả video lẫn lời đọc.
           *
           * Lấy giá trị lớn hơn thay vì để video quyết định: video ngắn hơn tiếng thì cắt
           * cụt câu đang nói, còn giữ khung cuối thêm một nhịp thì người xem gần như
           * không nhận ra.
           */
          durationMs:
            asset.kind === 'video' && asset.durationMs
              ? Math.max(line.durationMs, asset.durationMs)
              : line.durationMs,
          assetUrl: urls.get(line.assetId!)!,
          assetKind: asset.kind,
        };
      }),
      voiceClips,
      variationSeed,
    });

    if (!config) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Không dựng được cấu hình video từ dự án này',
      });
    }

    return config;
  }
}
