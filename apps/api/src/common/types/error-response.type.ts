import type { ErrorCode } from '../constants/error-code.constant.js';

/** Format JSON thống nhất cho mọi lỗi trả về từ API. */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  /** Mã lỗi ổn định để client xử lý logic, không phụ thuộc vào message. */
  code: ErrorCode;
  message: string;
  /** Thông tin bổ sung: danh sách lỗi validation, field liên quan... */
  details?: unknown;
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
}
