import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { OUTPUT_PRESETS } from '@repo/shared';
import type { AspectRatio, Project, Resolution } from '../projects/project.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { MediaAsset, type MediaKind, type MediaVariant } from './media-asset.entity.js';
import { probeGif, probeMp4 } from './probe.js';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Video nặng hơn ảnh nhiều lần, nhưng vẫn phải tải hết về trình duyệt để dựng. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 400;
export const MAX_ASSETS_PER_PROJECT = 30;
/** Video dài hơn mức này thì một dự án 60 giây không dùng tới, mà encode lại rất lâu. */
export const MAX_VIDEO_MS = 120_000;

/**
 * Nhận diện định dạng bằng **magic bytes**, không tin phần mở rộng hay `mimetype` do
 * trình duyệt khai. Một file `.jpg` có thể chứa bất cứ thứ gì.
 */
const detectImageType = (buffer: Buffer): 'jpeg' | 'png' | 'webp' | null => {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
};

/**
 * Nhận diện loại tài nguyên, vẫn bằng **magic bytes**.
 *
 * MP4 không có chữ ký ở byte đầu: nó bắt đầu bằng một box `ftyp` mà 4 byte đầu là kích
 * thước. Vì vậy phải đọc tên box ở offset 4 chứ không phải offset 0.
 */
const detectKind = (buffer: Buffer): MediaKind | null => {
  if (detectImageType(buffer)) return 'image';

  if (buffer.length >= 10) {
    const signature = buffer.toString('ascii', 0, 6);
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'gif';
  }

  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'video';

  return null;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(MediaAsset)
    private readonly assets: Repository<MediaAsset>,
    private readonly storage: StorageService,
  ) {}

  async listByProject(projectId: string): Promise<MediaAsset[]> {
    return this.assets.find({
      where: { projectId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Nhận một ảnh, xử lý lại rồi lưu bản gốc cùng bản resize theo khổ của dự án.
   *
   * Ảnh **luôn được `sharp` đọc và ghi lại** chứ không lưu nguyên byte người dùng gửi lên:
   * việc này loại bỏ payload nhúng trong metadata và đảm bảo file thật sự là ảnh giải mã
   * được, không phải thứ gì đó đội lốt.
   */
  async upload(
    project: Project,
    file: { buffer: Buffer; originalname?: string },
    origin: MediaAsset['origin'] = 'uploaded',
    sourceUrl: string | null = null,
  ): Promise<MediaAsset> {
    const count = await this.assets.count({ where: { projectId: project.id } });
    if (count >= MAX_ASSETS_PER_PROJECT) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mỗi dự án tối đa ${MAX_ASSETS_PER_PROJECT} tài nguyên`,
      });
    }

    const kind = detectKind(file.buffer);

    if (!kind) {
      throw new BusinessException('UNSUPPORTED_MEDIA_TYPE', {
        message: 'Chỉ nhận ảnh JPG, PNG, WebP, ảnh động GIF hoặc video MP4',
      });
    }

    if (kind !== 'image') {
      return this.uploadPlayable(project, file, kind, count, origin, sourceUrl);
    }

    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BusinessException('PAYLOAD_TOO_LARGE', {
        message: 'Ảnh vượt quá 20MB',
      });
    }

    let pipeline: Sharp;
    let metadata: Metadata;

    try {
      pipeline = sharp(file.buffer, { failOn: 'error' });
      metadata = await pipeline.metadata();
    } catch (cause) {
      throw new BusinessException('IMAGE_CORRUPT', { cause });
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Ảnh cần tối thiểu ${MIN_IMAGE_SIDE}×${MIN_IMAGE_SIDE} điểm ảnh`,
      });
    }

    const assetId = randomUUID();
    const sourceKey = `projects/${project.id}/assets/${assetId}/source.jpg`;

    // Ghi lại bằng JPEG chất lượng cao: một định dạng duy nhất cho mọi bản gốc giúp bước
    // resize và bước vẽ canvas không phải phân nhánh theo định dạng đầu vào.
    const normalized = await sharp(file.buffer)
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer();

    await this.storage.put(sourceKey, normalized, 'image/jpeg');

    const asset = new MediaAsset();
    asset.id = assetId;
    asset.projectId = project.id;
    asset.origin = origin;
    asset.sourceKey = sourceKey;
    asset.mimeType = 'image/jpeg';
    asset.kind = 'image';
    asset.durationMs = null;
    asset.width = width;
    asset.height = height;
    asset.byteSize = normalized.length;
    asset.sourceUrl = sourceUrl;
    asset.sortOrder = count;
    asset.variants = [];

    const saved = await this.assets.save(asset);

    // Resize ngay cho khổ hiện tại của dự án. Đổi khổ sau sẽ sinh thêm bản mới khi cần.
    await this.ensureVariant(saved, project.aspectRatio, project.resolution);

    return saved;
  }

  /**
   * Nhận video hoặc GIF.
   *
   * Khác hẳn nhánh ảnh ở hai điểm, và cả hai đều là chủ ý:
   *
   * - **Không đi qua `sharp`, không resize.** Đổi kích thước video cần ffmpeg, mà cả hệ
   *   thống đang cố ý không có nó — việc dựng hình nằm ở máy khách. Trình duyệt tự co giãn
   *   khung hình khi vẽ lên canvas.
   * - **Lưu nguyên byte gốc.** Với ảnh, việc ghi lại qua `sharp` loại được payload nhúng;
   *   với video ta không có bước tương đương, nên bù lại bằng cách kiểm tra header thật sự
   *   đọc được và chặn kích thước lẫn thời lượng.
   */
  private async uploadPlayable(
    project: Project,
    file: { buffer: Buffer; originalname?: string },
    kind: 'video' | 'gif',
    count: number,
    origin: MediaAsset['origin'],
    sourceUrl: string | null,
  ): Promise<MediaAsset> {
    const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (file.buffer.length > limit) {
      throw new BusinessException('PAYLOAD_TOO_LARGE', {
        message:
          kind === 'video'
            ? `Video vượt quá ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB`
            : 'Ảnh động vượt quá 20MB',
      });
    }

    // Tách hai nhánh thay vì gộp thành một union: chỉ video mới có thời lượng, và gộp lại
    // thì mỗi lần đọc `durationMs` đều phải kiểm tra kiểu ở chỗ gọi.
    const video = kind === 'video' ? probeMp4(file.buffer) : null;
    const gif = kind === 'gif' ? probeGif(file.buffer) : null;
    const info: { width: number; height: number } | null = video ?? gif;
    const durationMs: number | null = video?.durationMs ?? null;

    if (!info) {
      throw new BusinessException('UNSUPPORTED_MEDIA_TYPE', {
        message:
          kind === 'video'
            ? 'Không đọc được thông tin video. Hãy dùng file MP4 chuẩn.'
            : 'File GIF không đọc được',
      });
    }

    if (info.width < MIN_IMAGE_SIDE || info.height < MIN_IMAGE_SIDE) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Khung hình cần tối thiểu ${MIN_IMAGE_SIDE}×${MIN_IMAGE_SIDE} điểm ảnh`,
      });
    }

    if (durationMs !== null && (durationMs <= 0 || durationMs > MAX_VIDEO_MS)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Video phải dài từ 1 đến ${MAX_VIDEO_MS / 1000} giây`,
      });
    }

    const assetId = randomUUID();
    const extension = kind === 'video' ? 'mp4' : 'gif';
    const mimeType = kind === 'video' ? 'video/mp4' : 'image/gif';
    const sourceKey = `projects/${project.id}/assets/${assetId}/source.${extension}`;

    await this.storage.put(sourceKey, file.buffer, mimeType);

    const asset = new MediaAsset();
    asset.id = assetId;
    asset.projectId = project.id;
    asset.origin = origin;
    asset.kind = kind;
    asset.sourceKey = sourceKey;
    asset.mimeType = mimeType;
    asset.width = info.width;
    asset.height = info.height;
    asset.durationMs = durationMs;
    asset.byteSize = file.buffer.length;
    asset.sourceUrl = sourceUrl;
    asset.sortOrder = count;
    // Không có bản resize: `signedVariantUrl` sẽ trả thẳng file gốc cho loại này.
    asset.variants = [];

    return this.assets.save(asset);
  }

  /**
   * Bảo đảm có bản resize đúng kích thước đích.
   *
   * Bước này hay bị bỏ qua nhưng ảnh hưởng lớn: ảnh sản phẩm từ sàn có thể tới 3000px, để
   * máy khách tải bản gốc rồi decode thì RAM tab tăng gấp nhiều lần và preview giật.
   * Resize ở máy chủ làm một lần rồi dùng lại cho mọi lần render.
   */
  async ensureVariant(
    asset: MediaAsset,
    aspectRatio: AspectRatio,
    resolution: Resolution,
  ): Promise<MediaVariant> {
    const preset = OUTPUT_PRESETS[aspectRatio][resolution];
    const existing = asset.variants.find(
      (variant) => variant.width === preset.width && variant.height === preset.height,
    );
    if (existing) return existing;

    const source = await this.storage.getBuffer(asset.sourceKey);
    const resized = await sharp(source)
      // `cover` cắt cho đầy khung; Ken Burns cần dư địa nên phóng thêm một chút.
      .resize(preset.width, preset.height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 88 })
      .toBuffer();

    const key = `projects/${asset.projectId}/assets/${asset.id}/${preset.width}x${preset.height}.jpg`;
    await this.storage.put(key, resized, 'image/jpeg');

    const variant: MediaVariant = {
      width: preset.width,
      height: preset.height,
      key,
      byteSize: resized.length,
    };

    asset.variants = [...asset.variants, variant];
    await this.assets.save(asset);

    return variant;
  }

  /** URL có chữ ký cho bản resize đúng khổ — thứ máy khách thật sự tải về để vẽ. */
  async signedVariantUrl(
    asset: MediaAsset,
    aspectRatio: AspectRatio,
    resolution: Resolution,
  ): Promise<string> {
    // Video và GIF không có bản resize — đổi kích thước chúng cần ffmpeg, mà cả hệ thống
    // cố ý không dùng. Trình duyệt tự co giãn khi vẽ lên canvas.
    if (asset.kind !== 'image') return this.storage.signedUrl(asset.sourceKey);

    const variant = await this.ensureVariant(asset, aspectRatio, resolution);
    return this.storage.signedUrl(variant.key);
  }

  async remove(asset: MediaAsset): Promise<void> {
    await this.assets.remove(asset);

    // Xoá file sau khi bản ghi đã đi: file mồ côi còn dọn được, bản ghi trỏ vào file
    // không tồn tại thì hỏng giao diện.
    void this.storage.remove(asset.sourceKey);
    for (const variant of asset.variants) {
      void this.storage.remove(variant.key);
    }
  }

  async findOwned(assetId: string, projectId: string): Promise<MediaAsset> {
    const asset = await this.assets.findOne({
      where: { id: assetId, projectId },
    });

    if (!asset) {
      throw new BusinessException('NOT_FOUND', { message: 'Không tìm thấy ảnh' });
    }

    return asset;
  }
}
