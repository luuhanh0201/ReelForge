import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { CrawlerService, type ImportLinkInput, type ImportLinkResult } from './crawler.service.js';

@Controller('projects/:projectId/import-link')
export class CrawlerController {
  constructor(private readonly crawler: CrawlerService) {}

  /**
   * Đọc link sản phẩm và điền vào dự án.
   *
   * Luôn trả 200 khi link đúng sàn, kể cả đọc hỏng — kết quả nằm ở `crawl.status` để giao
   * diện mở form nhập tay thay vì báo lỗi.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async importLink(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: ImportLinkInput | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportLinkResult> {
    const url = body?.url;
    const overwrite = body?.overwrite;

    if (
      (url !== undefined && typeof url !== 'string') ||
      (overwrite !== undefined && typeof overwrite !== 'boolean')
    ) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: '"url" phải là chuỗi, "overwrite" phải là true hoặc false',
      });
    }

    return this.crawler.importLink(projectId, user.id, { url, overwrite });
  }
}
