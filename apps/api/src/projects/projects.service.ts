import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  Project,
  type AspectRatio,
  type ProjectLine,
  type ProjectMode,
  type Resolution,
} from './project.entity.js';
import {
  buildLinesFromTemplate,
  findTemplate,
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  SCRIPT_TEMPLATES,
  SECONDS_PER_LINE,
} from './script-templates.js';

export interface CreateProjectInput {
  title?: string;
  mode: ProjectMode;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  sourceUrl?: string;
}

export interface UpdateProjectInput {
  title?: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  product?: Record<string, unknown>;
  subtitleStyle?: Record<string, unknown>;
  voiceId?: string | null;
  voiceSpeed?: number;
}

export interface ApplyTemplateInput {
  templateCode: string;
  durationSec: number;
}

/** Trần số cảnh, suy từ độ dài tối đa: 60 giây, mỗi cảnh khoảng 10 giây. */
export const MAX_LINES = MAX_DURATION_SEC / SECONDS_PER_LINE;

const ASPECT_RATIOS: readonly AspectRatio[] = ['9:16', '1:1', '16:9'];
const LINE_ROLES: readonly ProjectLine['role'][] = ['hook', 'usp', 'cta'];
const RESOLUTIONS: readonly Resolution[] = ['720p', '1080p', '2k'];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  /** Mọi truy vấn đều đi kèm `userId`: không ai đọc hay sửa được dự án của người khác. */
  private async findOwned(id: string, userId: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id, userId } });

    if (!project) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy dự án',
      });
    }

    return project;
  }

  async list(userId: string): Promise<Project[]> {
    return this.projects.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }

  async detail(id: string, userId: string): Promise<Project> {
    return this.findOwned(id, userId);
  }

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    if (input.mode !== 'link' && input.mode !== 'manual') {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Chế độ tạo video chỉ nhận "link" hoặc "manual"',
      });
    }

    const project = new Project();
    project.userId = userId;
    project.title = input.title?.trim() || 'Dự án chưa đặt tên';
    project.mode = input.mode;
    project.status = 'draft';
    project.aspectRatio = this.assertAspectRatio(input.aspectRatio ?? '9:16');
    project.resolution = this.assertResolution(input.resolution ?? '1080p');
    project.sourceUrl = input.sourceUrl?.trim() || null;
    project.product = {};
    project.lines = [];
    project.scriptTemplate = null;
    project.subtitleStyle = {};
    project.voiceId = null;
    project.voiceSpeed = 1;

    return this.projects.save(project);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length < 1 || title.length > 200) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Tên dự án cần từ 1 đến 200 ký tự',
        });
      }
      project.title = title;
    }

    if (input.aspectRatio !== undefined) {
      project.aspectRatio = this.assertAspectRatio(input.aspectRatio);
    }

    if (input.resolution !== undefined) {
      project.resolution = this.assertResolution(input.resolution);
    }

    if (input.product !== undefined) {
      project.product = input.product;
    }

    if (input.subtitleStyle !== undefined) {
      project.subtitleStyle = input.subtitleStyle;
    }

    if (input.voiceId !== undefined) {
      project.voiceId = input.voiceId;
    }

    if (input.voiceSpeed !== undefined) {
      // Ngoài khoảng này giọng đọc méo tới mức không dùng được, không phải "nhanh hơn".
      if (
        !Number.isFinite(input.voiceSpeed) ||
        input.voiceSpeed < 0.8 ||
        input.voiceSpeed > 1.5
      ) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Tốc độ đọc phải trong khoảng 0.8x đến 1.5x',
        });
      }
      project.voiceSpeed = input.voiceSpeed;
    }

    return this.projects.save(project);
  }

  async remove(id: string, userId: string): Promise<void> {
    const project = await this.findOwned(id, userId);
    await this.projects.remove(project);
  }

  /** Danh mục mẫu kịch bản cho giao diện chọn. */
  listTemplates() {
    return SCRIPT_TEMPLATES.map((template) => ({
      code: template.code,
      tone: template.tone,
      label: template.label,
      description: template.description,
      maxLines: template.lines.length,
    }));
  }

  /**
   * Điền kịch bản từ mẫu.
   *
   * Ghi đè toàn bộ `lines` — người dùng chọn mẫu khác nghĩa là muốn bắt đầu lại, không
   * phải trộn hai kịch bản vào nhau. Ảnh đã gán ở các cảnh cũ được giữ theo thứ tự để
   * không phải chọn lại từ đầu.
   */
  async applyTemplate(
    id: string,
    userId: string,
    input: ApplyTemplateInput,
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);
    const template = findTemplate(input.templateCode);

    if (!template) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy mẫu kịch bản này',
      });
    }

    if (
      !Number.isFinite(input.durationSec) ||
      input.durationSec < MIN_DURATION_SEC ||
      input.durationSec > MAX_DURATION_SEC
    ) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Độ dài video phải trong khoảng ${MIN_DURATION_SEC}–${MAX_DURATION_SEC} giây`,
      });
    }

    const product = project.product as { name?: string; price?: string };
    const lines = buildLinesFromTemplate(template, input.durationSec, product);
    const previousAssets = project.lines.map((line) => line.assetId);

    project.lines = lines.map((line, index) => ({
      ...line,
      assetId: previousAssets[index] ?? null,
    }));
    project.scriptTemplate = template.code;

    return this.projects.save(project);
  }

  /** Sửa thoại, đổi ảnh hoặc đổi cụm nhấn của một cảnh. */
  async updateLine(
    id: string,
    userId: string,
    index: number,
    patch: Partial<Pick<ProjectLine, 'text' | 'assetId' | 'emphasis' | 'durationMs'>>,
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);
    const line = project.lines[index];

    if (!line) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy cảnh này trong dự án',
      });
    }

    if (patch.text !== undefined) {
      const text = patch.text.trim();
      if (text.length < 1 || text.length > 500) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Lời thoại cần từ 1 đến 500 ký tự',
        });
      }
      line.text = text;
    }

    if (patch.assetId !== undefined) line.assetId = patch.assetId;
    if (patch.emphasis !== undefined) line.emphasis = patch.emphasis;

    if (patch.durationMs !== undefined) {
      // Chặn hai đầu: cảnh dưới 1 giây không kịp đọc hết câu, trên 20 giây thì người xem
      // lướt qua mất.
      if (
        !Number.isFinite(patch.durationMs) ||
        patch.durationMs < 1000 ||
        patch.durationMs > 20_000
      ) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Thời lượng mỗi cảnh phải trong khoảng 1–20 giây',
        });
      }
      line.durationMs = Math.round(patch.durationMs);
    }

    // Cột jsonb chỉ được ghi lại khi mảng là tham chiếu mới.
    project.lines = [...project.lines];

    return this.projects.save(project);
  }

  async addLine(id: string, userId: string, text: string): Promise<Project> {
    const project = await this.findOwned(id, userId);

    if (project.lines.length >= MAX_LINES) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mỗi video tối đa ${MAX_LINES} cảnh (${MAX_DURATION_SEC} giây)`,
      });
    }

    project.lines = [
      ...project.lines,
      {
        index: project.lines.length,
        text: text.trim() || 'Nội dung cảnh mới',
        role: 'usp',
        assetId: null,
        emphasis: [],
        durationMs: SECONDS_PER_LINE * 1000,
      },
    ];

    return this.projects.save(project);
  }

  /**
   * Nhân bản một cảnh và đặt ngay sau bản gốc.
   *
   * Sao chép cả `role`, ảnh và cụm nhấn: người dùng bấm nhân bản là muốn một cảnh **giống
   * hệt** để sửa đi vài chữ, không phải một cảnh trắng.
   */
  async duplicateLine(
    id: string,
    userId: string,
    index: number,
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);
    const source = project.lines[index];

    if (!source) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy cảnh này trong dự án',
      });
    }

    if (project.lines.length >= MAX_LINES) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mỗi video tối đa ${MAX_LINES} cảnh (${MAX_DURATION_SEC} giây)`,
      });
    }

    const copy: ProjectLine = {
      ...source,
      emphasis: [...source.emphasis],
    };

    const lines = [...project.lines];
    lines.splice(index + 1, 0, copy);

    project.lines = lines.map((line, position) => ({ ...line, index: position }));

    return this.projects.save(project);
  }

  async removeLine(id: string, userId: string, index: number): Promise<Project> {
    const project = await this.findOwned(id, userId);

    if (!project.lines[index]) {
      throw new BusinessException('NOT_FOUND', {
        message: 'Không tìm thấy cảnh này trong dự án',
      });
    }

    // Đánh số lại để `index` luôn là vị trí thật trong mảng.
    project.lines = project.lines
      .filter((_, position) => position !== index)
      .map((line, position) => ({ ...line, index: position }));

    return this.projects.save(project);
  }

  /**
   * Thay toàn bộ danh sách cảnh trong một lần gọi.
   *
   * Có endpoint này thì thao tác **hoàn tác** mới làm được: khôi phục từng cảnh bằng nhiều
   * lệnh sửa lẻ sẽ để lại trạng thái nửa vời nếu một lệnh trong chuỗi hỏng.
   */
  async replaceLines(
    id: string,
    userId: string,
    lines: ProjectLine[],
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);

    if (!Array.isArray(lines) || lines.length > MAX_LINES) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: `Mỗi video tối đa ${MAX_LINES} cảnh (${MAX_DURATION_SEC} giây)`,
      });
    }

    project.lines = lines.map((line, index) => {
      const text = typeof line.text === 'string' ? line.text.trim() : '';

      if (text.length < 1 || text.length > 500) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Lời thoại cần từ 1 đến 500 ký tự',
        });
      }

      if (!LINE_ROLES.includes(line.role)) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Vai trò của cảnh không hợp lệ',
        });
      }

      if (
        !Number.isFinite(line.durationMs) ||
        line.durationMs < 1000 ||
        line.durationMs > 20_000
      ) {
        throw new BusinessException('VALIDATION_FAILED', {
          message: 'Thời lượng mỗi cảnh phải trong khoảng 1–20 giây',
        });
      }

      return {
        index,
        text,
        role: line.role,
        assetId: typeof line.assetId === 'string' ? line.assetId : null,
        emphasis: Array.isArray(line.emphasis)
          ? line.emphasis.filter((item): item is string => typeof item === 'string')
          : [],
        durationMs: Math.round(line.durationMs),
      };
    });

    return this.projects.save(project);
  }

  async reorderLines(
    id: string,
    userId: string,
    order: number[],
  ): Promise<Project> {
    const project = await this.findOwned(id, userId);

    const valid =
      order.length === project.lines.length &&
      new Set(order).size === order.length &&
      order.every((position) => project.lines[position] !== undefined);

    if (!valid) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Thứ tự cảnh không hợp lệ',
      });
    }

    project.lines = order.map((position, index) => ({
      ...project.lines[position]!,
      index,
    }));

    return this.projects.save(project);
  }

  private assertAspectRatio(value: AspectRatio): AspectRatio {
    if (!ASPECT_RATIOS.includes(value)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Khổ video chỉ nhận 9:16, 1:1 hoặc 16:9',
      });
    }
    return value;
  }

  private assertResolution(value: Resolution): Resolution {
    if (!RESOLUTIONS.includes(value)) {
      throw new BusinessException('VALIDATION_FAILED', {
        message: 'Độ phân giải chỉ nhận 720p, 1080p hoặc 2k',
      });
    }
    return value;
  }
}
