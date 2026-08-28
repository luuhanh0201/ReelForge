import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { BusinessException } from '../src/common/exceptions/business.exception.js';

@Controller('errors')
class ErrorsController {
  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException();
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException();
  }

  @Get('business')
  business(): never {
    throw new BusinessException('CONFLICT', {
      message: 'Video đang được render',
      details: { videoId: 'abc' },
    });
  }

  @Get('database')
  database(): never {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  }
}

describe('AllExceptionsFilter (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ErrorsController],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('trả về format thống nhất cho route không tồn tại (404)', async () => {
    const response = await request(app.getHttpServer())
      .get('/khong-ton-tai')
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/khong-ton-tai',
      method: 'GET',
    });
    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('trả về format thống nhất cho 401 và 403', async () => {
    const unauthorized = await request(app.getHttpServer())
      .get('/errors/unauthorized')
      .expect(401);
    expect(unauthorized.body).toMatchObject({
      success: false,
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });

    const forbidden = await request(app.getHttpServer())
      .get('/errors/forbidden')
      .expect(403);
    expect(forbidden.body).toMatchObject({
      success: false,
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('giữ nguyên message và details của business exception', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/business')
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Video đang được render',
      details: { videoId: 'abc' },
    });
  });

  it('che chi tiết lỗi hệ thống và trả về 500 theo format chung', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/database')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(response.body.message).not.toContain('ECONNREFUSED');
  });

  it('giữ lại x-request-id để trace log', async () => {
    const response = await request(app.getHttpServer())
      .get('/errors/forbidden')
      .set('x-request-id', 'req-123')
      .expect(403);

    expect(response.body.requestId).toBe('req-123');
  });
});
