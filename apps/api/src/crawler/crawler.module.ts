import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { CrawlerController } from './crawler.controller.js';
import { CrawlerService } from './crawler.service.js';

/** Đọc link sản phẩm Shopee / TikTok Shop / Lazada cho chế độ tạo video từ link. */
@Module({
  imports: [ProjectsModule, MediaModule],
  controllers: [CrawlerController],
  providers: [CrawlerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
