import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import type { Project, ProjectLine } from './project.entity.js';
import {
  ProjectsService,
  type ApplyTemplateInput,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './projects.service.js';

/**
 * Dự án video của người dùng.
 *
 * Không gắn `@Roles`: đây là khu vực của khách hàng, chỉ cần đăng nhập. Quyền sở hữu được
 * kiểm ở tầng service — mọi truy vấn đều kèm `userId`.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: Project[] }> {
    return { items: await this.projects.list(user.id) };
  }

  /** Danh mục mẫu kịch bản. Đặt trước `:id` để "templates" không bị hiểu là một id. */
  @Get('templates')
  templates() {
    return { items: this.projects.listTemplates() };
  }

  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.detail(id, user.id);
  }

  @Post()
  async create(
    @Body() body: CreateProjectInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.create(user.id, body);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.update(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.projects.remove(id, user.id);
  }

  /** Điền kịch bản từ mẫu có sẵn. Chỗ này sau sẽ có thêm đường sinh bằng AI. */
  @Post(':id/script/template')
  async applyTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApplyTemplateInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.applyTemplate(id, user.id, body);
  }

  @Post(':id/lines')
  async addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('text') text: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.addLine(id, user.id, text ?? '');
  }

  @Patch(':id/lines/:index')
  async updateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @Body()
    body: Partial<Pick<ProjectLine, 'text' | 'assetId' | 'emphasis' | 'durationMs'>>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.updateLine(id, user.id, index, body);
  }

  @Post(':id/lines/:index/duplicate')
  async duplicateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.duplicateLine(id, user.id, index);
  }

  @Delete(':id/lines/:index')
  async removeLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.removeLine(id, user.id, index);
  }

  /** Thay cả danh sách cảnh — dùng cho thao tác hoàn tác ở giao diện. */
  @Put(':id/lines')
  async replaceLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('lines') lines: ProjectLine[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.replaceLines(id, user.id, lines ?? []);
  }

  @Post(':id/lines/reorder')
  async reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('order') order: number[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Project> {
    return this.projects.reorderLines(id, user.id, order ?? []);
  }
}
