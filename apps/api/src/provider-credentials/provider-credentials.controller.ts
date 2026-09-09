import {
  Body,
  Controller,
  Delete,
  Get,
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
 */
@Controller('admin/provider-credentials')
@Roles('admin')
export class ProviderCredentialsController {
  constructor(
    private readonly credentials: ProviderCredentialsService,
    private readonly runtime: GoogleTtsCredentialProvider,
  ) {}

  @Get('google-tts')
  async status(): Promise<CredentialStatusView> {
    return this.credentials.getStatus();
  }

  @Put('google-tts')
  @UseInterceptors(
    // Memory storage: file không bao giờ chạm đĩa. limits chặn ngay ở tầng multer
    // để payload lớn bị cắt trước khi vào tới service.
    FileInterceptor('file', { limits: { fileSize: MAX_CREDENTIAL_FILE_BYTES, files: 1 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ): Promise<CredentialStatusView> {
    if (!file?.buffer) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thiếu file service account trong trường "file"',
      });
    }

    const result = await this.credentials.upload(file.buffer, clientIp(request));
    this.runtime.invalidate();

    return result;
  }

  @Post('google-tts/test')
  async test(@Req() request: Request): Promise<CredentialStatusView> {
    return this.credentials.test(clientIp(request));
  }

  @Patch('google-tts/status')
  async setStatus(
    @Body('status') status: string,
    @Req() request: Request,
  ): Promise<CredentialStatusView> {
    if (status !== 'connected' && status !== 'disabled') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'status chỉ nhận "connected" hoặc "disabled"',
      });
    }

    const result = await this.credentials.setStatus(status, clientIp(request));
    this.runtime.invalidate();

    return result;
  }

  @Delete('google-tts')
  async remove(@Req() request: Request): Promise<{ removed: boolean }> {
    const result = await this.credentials.remove(clientIp(request));
    this.runtime.invalidate();

    return result;
  }

  @Post('rotate-key')
  async rotateKey(
    @Req() request: Request,
  ): Promise<{ rotated: number; skipped: number }> {
    const result = await this.credentials.rotateKey(clientIp(request));
    this.runtime.invalidate();

    return result;
  }
}
