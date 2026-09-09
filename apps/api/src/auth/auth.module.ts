import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AuthConfig } from '../config/configuration.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OriginGuard } from './origin.guard.js';
import { RolesGuard } from './roles.guard.js';
import { TokenService } from './token.service.js';
import { User } from './user.entity.js';
import { UserSession } from './user-session.entity.js';
import { UsersService } from './users.service.js';

/**
 * Xác thực bằng Google + quản lý phiên đăng nhập.
 *
 * `@Global()` vì `JwtAuthGuard` được đăng ký làm guard toàn cục ở `AppModule` và cần
 * `TokenService` cùng repository `User`.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.getOrThrow<AuthConfig>('auth');

        return {
          secret: auth.jwtSecret,
          signOptions: { algorithm: 'HS256' as const },
          verifyOptions: { algorithms: ['HS256' as const] },
        };
      },
    }),
  ],
  controllers: [AuthController, AdminUsersController],
  providers: [
    AuthService,
    UsersService,
    TokenService,
    GoogleOAuthService,
    JwtAuthGuard,
    RolesGuard,
    OriginGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    RolesGuard,
    OriginGuard,
    // Guard toàn cục được dựng trong ngữ cảnh AppModule nên repository `User` phải nhìn
    // thấy được từ đó — module Global chỉ chia sẻ đúng những gì nó export.
    TypeOrmModule,
  ],
})
export class AuthModule {}
