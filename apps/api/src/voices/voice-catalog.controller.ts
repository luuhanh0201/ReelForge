import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
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

  /**
   * Nghe thử một giọng — **chỉ lấy bản đã có trong kho, không bao giờ tổng hợp mới**.
   *
   * Chọn giọng là việc người dùng làm bằng cách thử nhiều giọng liên tiếp. Nếu mỗi lần bấm
   * đều gọi nhà cung cấp thì tiền TTS sẽ tiêu theo số lần thử chứ không theo số video làm
   * ra — mà thử nhiều lại chính là hành vi ta muốn khuyến khích.
   */
  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ audioBase64: string; mimeType: string; sampleText: string }> {
    const cached = await this.voices.cachedPreview(id);

    if (!cached) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Giọng này chưa có bản nghe thử sẵn',
      });
    }

    return cached;
  }
}
