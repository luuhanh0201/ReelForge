import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDefinition {
  /** HTTP status mặc định khi throw error code này. */
  status: HttpStatus;
  /** Message mặc định trả về cho client (có thể override khi throw). */
  message: string;
}

/**
 * Nguồn sự thật duy nhất cho toàn bộ error code của API.
 * Thêm error code mới tại đây thay vì hardcode status/message rải rác trong service.
 */
export const ERROR_CODES = {
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Yêu cầu không hợp lệ',
  },
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Dữ liệu gửi lên không hợp lệ',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Bạn cần đăng nhập để tiếp tục',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'Bạn không có quyền thực hiện thao tác này',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Không tìm thấy tài nguyên yêu cầu',
  },
  METHOD_NOT_ALLOWED: {
    status: HttpStatus.METHOD_NOT_ALLOWED,
    message: 'Phương thức không được hỗ trợ',
  },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    message: 'Dữ liệu đã tồn tại hoặc đang xung đột',
  },
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Dữ liệu gửi lên vượt quá giới hạn cho phép',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'Định dạng dữ liệu không được hỗ trợ',
  },
  TOO_MANY_REQUESTS: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
  },
  DATABASE_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Hệ thống đang gặp sự cố dữ liệu, vui lòng thử lại sau',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
  },
  SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau',
  },

  /* --------------------------------------------------------------- */
  /* Xác thực & phiên đăng nhập                                        */
  /* --------------------------------------------------------------- */
  SESSION_EXPIRED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  },
  SESSION_REVOKED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Phiên đăng nhập đã bị thu hồi',
  },
  ACCOUNT_SUSPENDED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Tài khoản đã bị khoá',
  },
  GOOGLE_AUTH_FAILED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Không xác thực được tài khoản Google',
  },
  GOOGLE_OAUTH_NOT_CONFIGURED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Đăng nhập Google chưa được cấu hình trên máy chủ',
  },

  /* --------------------------------------------------------------- */
  /* Credential nhà cung cấp ngoài                                     */
  /* Lỗi nguyên bản của provider KHÔNG được trả về client — chỉ map     */
  /* sang các mã ổn định dưới đây, chi tiết chỉ nằm trong log server.   */
  /* --------------------------------------------------------------- */
  INVALID_SERVICE_ACCOUNT: {
    status: HttpStatus.BAD_REQUEST,
    message: 'File service account không hợp lệ',
  },
  CREDENTIAL_NOT_CONFIGURED: {
    status: HttpStatus.NOT_FOUND,
    message: 'Chưa cấu hình credential cho nhà cung cấp này',
  },
  GOOGLE_TTS_AUTH_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Google từ chối xác thực service account này',
  },
  GOOGLE_TTS_PERMISSION_DENIED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Service account thiếu quyền dùng Cloud Text-to-Speech',
  },
  GOOGLE_TTS_API_DISABLED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Cloud Text-to-Speech API chưa được bật trong project này',
  },
  GOOGLE_TTS_TIMEOUT: {
    status: HttpStatus.GATEWAY_TIMEOUT,
    message: 'Gọi Google Text-to-Speech quá thời gian chờ',
  },
  GOOGLE_TTS_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Không kết nối được tới Google Text-to-Speech',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Map HTTP status -> error code, dùng cho các exception dựng sẵn của Nest
 * (NotFoundException, UnauthorizedException, ForbiddenException...).
 */
const STATUS_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

export function resolveErrorCodeByStatus(status: number): ErrorCode {
  return (
    STATUS_TO_ERROR_CODE[status] ??
    (status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? 'INTERNAL_ERROR'
      : 'BAD_REQUEST')
  );
}
