import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import type { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TtsService } from './tts.service.js';

/** Một cảnh kèm đường dẫn nghe được — hình dạng giao diện và bộ xuất MP4 cùng dùng. */
export interface VoiceClipView {
  index: number;
  clipId: string;
  url: string;
  durationMs: number;
  sampleRate: number;
}

export interface SynthesizeResponse {
  project: Project;
  clips: VoiceClipView[];
  /** Số câu phải gọi sang Google lần này; phần còn lại lấy từ cache nên không tốn gì. */
  synthesized: number;
  quota: { used: number; limit: number };
}

/**
 * Lồng tiếng cho một dự án.
 *
 * Tách khỏi `ProjectsController` vì luồng này phụ thuộc vào `TtsModule`, còn
 * `ProjectsModule` thì không được biết gì về nhà cung cấp giọng đọc — để sau này đổi sang
 * nhà cung cấp khác chỉ phải sửa một chỗ.
 */
@Controller('projects/:id/voice')
export class ProjectVoiceController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tts: TtsService,
  ) {}

  /** Đường dẫn tiếng của các cảnh đã lồng — gọi mỗi lần mở dự án vì URL ký chỉ sống 1 giờ. */
  @Get()
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: VoiceClipView[]; quota: { used: number; limit: number } }> {
    const project = await this.projects.detail(id, user.id);

    return {
      items: await this.toViews(project),
      quota: await this.tts.remainingToday(user.id),
    };
  }

  /**
   * Tổng hợp tiếng cho cả video.
   *
   * Mặc định **bỏ qua cảnh đã có tiếng**: người dùng bấm nút này nhiều lần là chuyện bình
   * thường, và gọi lại Google cho những câu không đổi là đốt tiền vô ích. `force` chỉ dùng
   * khi họ chủ động muốn đọc lại tất cả.
   */
  @Post()
  async synthesize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('force') force: boolean | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SynthesizeResponse> {
    const project = await this.projects.detail(id, user.id);

    if (!project.voiceId) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Hãy chọn giọng đọc trước khi lồng tiếng',
      });
    }

    const pending = project.lines
      .filter((line) => force === true || !line.voiceClipId)
      .map((line) => ({ index: line.index, text: line.text }));

    if (pending.length === 0) {
      return {
        project,
        clips: await this.toViews(project),
        synthesized: 0,
        quota: await this.tts.remainingToday(user.id),
      };
    }

    const results = await this.tts.synthesizeLines(
      user.id,
      project.voiceId,
      project.voiceSpeed,
      pending,
    );

    const updated = await this.projects.attachVoice(id, user.id, results);

    return {
      project: updated,
      clips: await this.toViews(updated),
      synthesized: results.filter((result) => !result.cached).length,
      quota: await this.tts.remainingToday(user.id),
    };
  }

  private async toViews(project: Project): Promise<VoiceClipView[]> {
    const ids = project.lines
      .map((line) => line.voiceClipId)
      .filter((value): value is string => Boolean(value));

    const clips = await this.tts.findClips(ids);

    // Cảnh nào trỏ tới một đoạn không còn tồn tại thì bỏ qua, không dựng URL rỗng cho
    // trình duyệt tải về một lỗi 404.
    return Promise.all(
      project.lines.flatMap((line) => {
        const clip = line.voiceClipId ? clips.get(line.voiceClipId) : undefined;
        if (!clip) return [];

        return [
          this.tts.signedUrl(clip.id).then((url) => ({
            index: line.index,
            clipId: clip.id,
            url: url ?? '',
            durationMs: clip.durationMs,
            sampleRate: clip.sampleRate,
          })),
        ];
      }),
    );
  }
}
