import { Injectable } from '@nestjs/common';
import type { Project } from '../projects/project.entity.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AUTOBUILD_CONFIG } from './autobuild.config.js';

/**
 * Chỗ cắm cho bước viết kịch bản.
 *
 * Hôm nay chỉ có bản chạy bằng mẫu sẵn; bản dùng LLM sẽ là một cài đặt thứ hai của đúng
 * interface này. Nhờ vậy lúc cắm LLM không phải sửa `AutobuildService` — thứ đang giữ
 * trật tự của cả chuỗi và cách báo lỗi từng bước.
 */
export interface ScriptProvider {
  /** Tên hiện trong báo cáo từng bước, để biết kịch bản do đâu mà ra. */
  readonly id: string;
  /** Trả về dự án **đã lưu** kèm danh sách cảnh. */
  writeScript(
    project: Project,
    userId: string,
    options: { durationSec: number; templateCode?: string },
  ): Promise<Project>;
}

export const SCRIPT_PROVIDER = 'SCRIPT_PROVIDER';

/**
 * Bản chạy bằng bộ mẫu có sẵn.
 *
 * Kể cả khi đã cắm LLM, bản này vẫn cần: nhà cung cấp lỗi, hết quota, hoặc người dùng chỉ
 * muốn một khung nhanh để sửa tay.
 */
@Injectable()
export class TemplateScriptProvider implements ScriptProvider {
  readonly id = 'template';

  constructor(private readonly projects: ProjectsService) {}

  writeScript(
    project: Project,
    userId: string,
    options: { durationSec: number; templateCode?: string },
  ): Promise<Project> {
    return this.projects.applyTemplate(project.id, userId, {
      templateCode: options.templateCode ?? AUTOBUILD_CONFIG.defaultTemplateCode,
      durationSec: options.durationSec,
    });
  }
}
