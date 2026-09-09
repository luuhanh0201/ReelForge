import { Controller, Get } from '@nestjs/common';
import { VoicesService, type StudioVoiceView } from './voices.service.js';

/**
 * Danh mục giọng cho trang dựng video.
 *
 * Tách khỏi `VoicesController` (`/admin/voices`) chứ không thêm một route nữa vào đó:
 * hai controller phục vụ hai đối tượng khác nhau, trả hai hình dạng dữ liệu khác nhau, và
 * gộp lại thì sớm muộn cũng có ngày trường giá vốn lọt sang phía khách hàng.
 */
@Controller('voices')
export class VoiceCatalogController {
  constructor(private readonly voices: VoicesService) {}

  @Get()
  async list(): Promise<{ items: StudioVoiceView[] }> {
    return { items: await this.voices.listEnabled() };
  }
}
