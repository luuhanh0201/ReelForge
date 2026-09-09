import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailConfig } from '../config/configuration.js';

export interface MailMessage {
  to: string;
  subject: string;
  /** Nội dung thuần — luôn bắt buộc, vì nhiều hộp thư chặn HTML. */
  text: string;
  html: string;
}

/**
 * Gửi mail qua SMTP.
 *
 * Hai nguyên tắc:
 * 1. **Chưa cấu hình SMTP thì không phải lỗi.** Thiếu cấu hình chỉ ghi nội dung mail ra
 *    log server để dev vẫn chạy được; nối nhà cung cấp về sau chỉ là điền biến môi trường.
 * 2. **Gửi mail hỏng không được làm hỏng nghiệp vụ.** Không ai bị chặn đăng nhập chỉ vì
 *    máy chủ mail chết — giống cách `AuditLogService` nuốt lỗi ghi log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly config: MailConfig;
  private transporter: Transporter | null = null;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<MailConfig>('mail');
  }

  get enabled(): boolean {
    return Boolean(this.config.host && this.config.from);
  }

  private getTransporter(): Transporter | null {
    if (!this.enabled) return null;

    this.transporter ??= createTransport({
      host: this.config.host,
      port: this.config.port,
      // Cổng 465 dùng TLS ngay từ đầu; 587 bắt đầu bằng kết nối thường rồi STARTTLS.
      secure: this.config.port === 465,
      auth: this.config.user
        ? { user: this.config.user, pass: this.config.password }
        : undefined,
    });

    return this.transporter;
  }

  async send(message: MailMessage): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(
        `SMTP chưa cấu hình — mail "${message.subject}" gửi tới ${message.to} chỉ được ghi log`,
      );
      this.logger.debug(message.text);
      return false;
    }

    try {
      await transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Không gửi được mail "${message.subject}" tới ${message.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
