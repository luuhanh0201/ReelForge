import { Injectable } from '@nestjs/common';
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

export interface SynthesizeResult {
  project: Project;
  clips: VoiceClipView[];
  /** Số câu phải gọi sang Google lần này; phần còn lại lấy từ cache nên không tốn gì. */
  synthesized: number;
  quota: { used: number; limit: number };
}

/**
 * Lồng tiếng cho cả một dự án.
 *
 * Tách khỏi controller vì luồng tạo video tự động cũng cần đúng thao tác này. Hai nơi gọi
 * chung một hàm thì không có chuyện một đường trừ hạn mức còn đường kia thì quên.
 */
@Injectable()
export class ProjectVoiceService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tts: TtsService,
  ) {}

  /**
   * Tổng hợp tiếng cho các cảnh còn thiếu.
   *
   * `force` đọc lại **mọi** câu kể cả câu đã có tiếng — chỉ dùng khi người dùng chủ động
   * muốn vậy, vì nó gọi lại nhà cung cấp và tốn hạn mức trong ngày.
   */
  async synthesizeProject(
    project: Project,
    userId: string,
    force = false,
  ): Promise<SynthesizeResult> {
    if (!project.voiceId) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Hãy chọn giọng đọc trước khi lồng tiếng',
      });
    }

    const pending = project.lines
      .filter((line) => force || !line.voiceClipId)
      .map((line) => ({ index: line.index, text: line.text }));

    if (pending.length === 0) {
      return {
        project,
        clips: await this.toViews(project),
        synthesized: 0,
        quota: await this.tts.remainingToday(userId),
      };
    }

    const results = await this.tts.synthesizeLines(
      userId,
      project.voiceId,
      project.voiceSpeed,
      pending,
    );

    const updated = await this.projects.attachVoice(project.id, userId, results);

    return {
      project: updated,
      clips: await this.toViews(updated),
      synthesized: results.filter((result) => !result.cached).length,
      quota: await this.tts.remainingToday(userId),
    };
  }

  async quota(userId: string): Promise<{ used: number; limit: number }> {
    return this.tts.remainingToday(userId);
  }

  async toViews(project: Project): Promise<VoiceClipView[]> {
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
