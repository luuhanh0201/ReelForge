import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ERROR_CODES,
  resolveErrorCodeByStatus,
  type ErrorCode,
} from '../constants/error-code.constant.js';
import { BusinessException } from '../exceptions/business.exception.js';
import type { ErrorResponse } from '../types/error-response.type.js';

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Bắt mọi exception (HttpException của Nest, BusinessException, lỗi database,
 * lỗi không xác định) và trả về cùng một JSON format.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, code, message, details } = this.normalize(exception);
    const requestId = this.resolveRequestId(request);

    const body: ErrorResponse = {
      success: false,
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      path: request.originalUrl ?? request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      ...(requestId === undefined ? {} : { requestId }),
    };

    this.log(exception, body);

    response.status(status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    // Lỗi không xác định (database driver, network, bug runtime...): không lộ
    // chi tiết nội bộ ra client ở môi trường production.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: ERROR_CODES.INTERNAL_ERROR.message,
      details: this.isProduction()
        ? undefined
        : { reason: this.describe(exception) },
    };
  }

  private normalizeHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return {
        status,
        code: resolveErrorCodeByStatus(status),
        message: payload,
      };
    }

    const { message } = payload as { message?: unknown };

    // ValidationPipe trả message dạng mảng -> gom vào details.
    if (Array.isArray(message)) {
      return {
        status,
        code: 'VALIDATION_FAILED',
        message: ERROR_CODES.VALIDATION_FAILED.message,
        details: message,
      };
    }

    const code = resolveErrorCodeByStatus(status);

    return {
      status,
      code,
      message:
        typeof message === 'string' ? message : ERROR_CODES[code].message,
    };
  }

  private resolveRequestId(request: Request): string | undefined {
    const header = request.headers['x-request-id'];
    return Array.isArray(header) ? header[0] : header;
  }

  private log(exception: unknown, body: ErrorResponse): void {
    const context = `${body.method} ${body.path} -> ${body.statusCode} ${body.code}`;

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        context,
        exception instanceof Error ? exception.stack : this.describe(exception),
      );
      return;
    }

    this.logger.warn(`${context}: ${body.message}`);
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) {
      return `${exception.name}: ${exception.message}`;
    }
    return String(exception);
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}
