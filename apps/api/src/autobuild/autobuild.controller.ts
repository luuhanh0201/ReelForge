import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { AutobuildService, type AutobuildInput, type AutobuildResult } from './autobuild.service.js';

@Controller('projects/:projectId/autobuild')
export class AutobuildController {
  constructor(private readonly autobuild: AutobuildService) {}

  /**
   * Dựng sẵn cả video: đọc link, viết kịch bản, gán ảnh, chọn giọng, lồng tiếng.
   *
   * Luôn trả 200 kèm báo cáo từng bước — bước hỏng là chuyện bình thường (sàn chặn, hết
   * hạn mức) và người dùng vẫn đi tiếp được bằng tay.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async run(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: AutobuildInput | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AutobuildResult> {
    const { force, templateCode, durationSec } = body ?? {};

    if (
      (force !== undefined && typeof force !== 'boolean') ||
      (templateCode !== undefined && typeof templateCode !== 'string') ||
      (durationSec !== undefined && typeof durationSec !== 'number')
    ) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Tham số dựng tự động không hợp lệ',
      });
    }

    return this.autobuild.run(projectId, user.id, { force, templateCode, durationSec });
  }
}
