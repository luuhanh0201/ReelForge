import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { MAX_CREDENTIAL_FILE_BYTES } from './google-service-account.validator.js';
import { GeminiCredentialProvider } from './gemini-credential.provider.js';
import { GoogleTtsCredentialProvider } from './google-tts-credential.provider.js';
import {
  ProviderCredentialsService,
  type CredentialStatusView,
} from './provider-credentials.service.js';

const clientIp = (request: Request): string | null => request.ip ?? null;

/**
 * Quản lý credential nhà cung cấp ngoài.
 *
 * Xem `.agent/backend/google-tts-credentials.md`. Response ở đây **chỉ được chứa
 * metadata đã che** — không có endpoint nào trả về credential gốc.
 *
 * Các route nhận `:provider` nên đường dẫn cũ của Google TTS
 * (`/admin/provider-credentials/google-tts`) vẫn đúng nguyên, không cần alias.
 */
@Controller('admin/provider-credentials')
@Roles('admin')
export class ProviderCredentialsController {
  constructor(
    private readonly credentials: ProviderCredentialsService,
    private readonly runtime: GoogleTtsCredentialProvider,
    private readonly gemini: GeminiCredentialProvider,
  ) {}

  /** Mọi thao tác ghi đều phải xoá cache của các nơi đọc credential lúc chạy. */
  private invalidateRuntime(): void {
    this.runtime.invalidate();
    this.gemini.invalidate();
  }

  /** Danh sách nhà cung cấp kèm trạng thái. Khai trước `:provider` để không bị nuốt. */
  @Get()
  async list(): Promise<{ items: CredentialStatusView[] }> {
    return { items: await this.credentials.listStatuses() };
  }

  /**
   * Xoay khoá mã hoá cho **mọi** nhà cung cấp.
   *
   * Khai trước các route `:provider` vì `rotate-key` cũng là một đoạn đường dẫn đơn.
   */
  @Post('rotate-key')
  async rotateKey(@Req() request: Request): Promise<{ rotated: number; skipped: number }> {
    const result = await this.credentials.rotateKey(clientIp(request));
    this.invalidateRuntime();

    return result;
  }

  @Get(':provider')
  async status(@Param('provider') provider: string): Promise<CredentialStatusView> {
    return this.credentials.getStatus(provider);
  }

  /**
   * Tải lên credential mới.
   *
   * Service account đi bằng file (`multipart/form-data`), api key đi bằng chuỗi trong
   * `value`. Nhận cả hai ở một route vì phía sau chúng đi chung một đường: validate → gọi
   * thử → mã hoá → ghi.
   */
  @Put(':provider')
  @UseInterceptors(
    // Memory storage: file không bao giờ chạm đĩa. limits chặn ngay ở tầng multer
    // để payload lớn bị cắt trước khi vào tới service.
    FileInterceptor('file', { limits: { fileSize: MAX_CREDENTIAL_FILE_BYTES, files: 1 } }),
  )
  async upload(
    @Param('provider') provider: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('value') value: unknown,
    @Req() request: Request,
  ): Promise<CredentialStatusView> {
    if (value !== undefined && typeof value !== 'string') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: '"value" phải là chuỗi',
      });
    }

    const result = await this.credentials.upload(
      provider,
      { file: file?.buffer, value },
      clientIp(request),
    );
    this.invalidateRuntime();

    return result;
  }

  @Post(':provider/test')
  async test(
    @Param('provider') provider: string,
    @Req() request: Request,
  ): Promise<CredentialStatusView> {
    return this.credentials.test(provider, clientIp(request));
  }

  @Patch(':provider/status')
  async setStatus(
    @Param('provider') provider: string,
    @Body('status') status: string,
    @Req() request: Request,
  ): Promise<CredentialStatusView> {
    if (status !== 'connected' && status !== 'disabled') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'status chỉ nhận "connected" hoặc "disabled"',
      });
    }

    const result = await this.credentials.setStatus(provider, status, clientIp(request));
    this.invalidateRuntime();

    return result;
  }

  @Delete(':provider')
  async remove(
    @Param('provider') provider: string,
    @Req() request: Request,
  ): Promise<{ removed: boolean }> {
    const result = await this.credentials.remove(provider, clientIp(request));
    this.invalidateRuntime();

    return result;
  }
}
