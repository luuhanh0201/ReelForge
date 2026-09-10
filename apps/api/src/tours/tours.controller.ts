import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Tour } from '@repo/shared';
import type { AuthenticatedUser } from '../auth/authenticated-user.type.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { TourStatus } from './user-tour-state.entity.js';
import { ToursService } from './tours.service.js';

/**
 * Tour nhìn từ phía người dùng.
 *
 * Trả kèm trạng thái của chính họ để giao diện quyết định có tự mở hay không — hỏi hai
 * request cho một quyết định duy nhất là làm chậm đúng khoảnh khắc trang vừa mở.
 */
@Controller('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get(':key')
  async detail(
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    tour: Tour;
    state: { status: TourStatus; lastStepId: string | null } | null;
  }> {
    const [tour, state] = await Promise.all([
      this.tours.current(key),
      this.tours.stateFor(user.id, key),
    ]);

    return {
      tour,
      state: state ? { status: state.status, lastStepId: state.lastStepId } : null,
    };
  }

  /** Ghi lại người dùng đang ở bước nào, hoặc đã bỏ qua ở đâu. */
  @Post(':key/progress')
  async progress(
    @Param('key') key: string,
    @Body() body: { status?: TourStatus; lastStepId?: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.tours.saveState(
      user.id,
      key,
      body.status ?? 'running',
      body.lastStepId ?? null,
    );

    return { ok: true };
  }
}
