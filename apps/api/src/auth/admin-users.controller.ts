import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './authenticated-user.type.js';
import { Roles } from './roles.decorator.js';
import { toSessionView, type SessionView } from './auth.controller.js';
import {
  UsersService,
  type AdminUserStats,
  type AdminUserView,
  type UpdateUserInput,
} from './users.service.js';

/**
 * Quản trị người dùng và phiên đăng nhập của họ.
 * `@Roles('admin')` thay cho `LocalOnlyGuard` trước đây — đây là auth thật.
 */
@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Query('search') search?: string,
  ): Promise<{ items: AdminUserView[] }> {
    return { items: await this.users.list(search) };
  }

  /** Đặt trước `:id` — nếu không "stats" sẽ bị hiểu là một user id và trả về 400. */
  @Get('stats')
  async stats(): Promise<AdminUserStats> {
    return this.users.stats();
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserInput,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AdminUserView> {
    return this.users.update(
      id,
      body,
      { id: actor.id, email: actor.email },
      request.ip ?? null,
    );
  }

  @Get(':id/sessions')
  async sessions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ items: SessionView[] }> {
    const items = await this.users.listSessions(id);

    // Admin xem thiết bị của người khác nên không có phiên nào là "thiết bị này".
    return { items: items.map((session) => toSessionView(session, null)) };
  }

  @Delete(':id/sessions')
  async revokeSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ revoked: number }> {
    return {
      revoked: await this.users.revokeAllSessions(
        id,
        actor.email,
        request.ip ?? null,
      ),
    };
  }
}
