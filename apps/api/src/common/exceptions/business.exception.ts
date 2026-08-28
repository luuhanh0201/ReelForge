import { HttpException } from '@nestjs/common';
import {
  ERROR_CODES,
  type ErrorCode,
} from '../constants/error-code.constant.js';

export interface BusinessExceptionOptions {
  /** Override message mặc định của error code. */
  message?: string;
  /** Dữ liệu bổ sung trả về cho client (field lỗi, giới hạn còn lại...). */
  details?: unknown;
  /** Lỗi gốc, chỉ dùng để log, không trả về client. */
  cause?: unknown;
}

/**
 * Exception cho lỗi nghiệp vụ. Status và message mặc định lấy từ ERROR_CODES.
 *
 * @example
 * throw new BusinessException('NOT_FOUND', { message: 'Không tìm thấy video' });
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, options: BusinessExceptionOptions = {}) {
    const definition = ERROR_CODES[code];
    super(options.message ?? definition.message, definition.status, {
      cause: options.cause,
    });
    this.code = code;
    this.details = options.details;
  }
}
