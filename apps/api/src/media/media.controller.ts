import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { MediaKind } from './media-asset.entity.js';
import { MAX_VIDEO_BYTES, MediaService } from './media.service.js';

/** Ảnh trả về cho giao diện: chỉ URL đã ký, không lộ khoá lưu trữ. */
export interface MediaAssetView {
  id: string;
  kind: MediaKind;
  /** Chỉ video mới có; ảnh và GIF do người dùng đặt thời lượng cảnh. */
  durationMs: number | null;
  url: string;
  width: number;
  height: number;
  sortOrder: number;
}

@Controller('projects/:projectId/assets')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: MediaAssetView[] }> {
    const project = await this.projects.detail(projectId, user.id);
    const assets = await this.media.listByProject(projectId);

    return {
      items: await Promise.all(
        assets.map(async (asset) => ({
          id: asset.id,
          kind: asset.kind,
          durationMs: asset.durationMs,
          url: await this.media.signedVariantUrl(
            asset,
            project.aspectRatio,
            project.resolution,
          ),
          width: asset.width,
          height: asset.height,
          sortOrder: asset.sortOrder,
        })),
      ),
    };
  }

  @Post()
  @UseInterceptors(
    // Trần ở tầng này lấy theo loại nặng nhất; `MediaService` mới là nơi áp đúng trần cho
    // từng loại, vì phải đọc magic bytes mới biết đang nhận ảnh hay video.
    FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES, files: 1 } }),
  )
  async upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaAssetView> {
    if (!file?.buffer) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thiếu tệp trong trường "file"',
      });
    }

    const project = await this.projects.detail(projectId, user.id);
    const asset = await this.media.upload(project, file);

    return {
      id: asset.id,
      kind: asset.kind,
      durationMs: asset.durationMs,
      url: await this.media.signedVariantUrl(
        asset,
        project.aspectRatio,
        project.resolution,
      ),
      width: asset.width,
      height: asset.height,
      sortOrder: asset.sortOrder,
    };
  }

  @Delete(':assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.projects.detail(projectId, user.id);
    await this.media.remove(await this.media.findOwned(assetId, projectId));
  }
}
