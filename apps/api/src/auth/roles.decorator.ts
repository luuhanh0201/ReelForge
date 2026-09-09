import { SetMetadata } from '@nestjs/common';
import type { UserRole } from './user.entity.js';

export const ROLES_KEY = 'auth:roles';

/** Giới hạn route cho một số vai. Không khai báo thì chỉ cần đăng nhập là đủ. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
