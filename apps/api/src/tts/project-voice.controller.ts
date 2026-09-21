import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  ProjectVoiceService,
  type SynthesizeResult,
  type VoiceClipView,
} from './project-voice.service.js';

export type { VoiceClipView };
export type SynthesizeResponse = SynthesizeResult;

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
    private readonly voice: ProjectVoiceService,
  ) {}

  /** Đường dẫn tiếng của các cảnh đã lồng — gọi mỗi lần mở dự án vì URL ký chỉ sống 1 giờ. */
  @Get()
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: VoiceClipView[]; quota: { used: number; limit: number } }> {
    const project = await this.projects.detail(id, user.id);

    return {
      items: await this.voice.toViews(project),
      quota: await this.voice.quota(user.id),
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
  ): Promise<SynthesizeResult> {
    const project = await this.projects.detail(id, user.id);

    return this.voice.synthesizeProject(project, user.id, force === true);
  }
}
