import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

interface Recipient {
  email: string;
  name: string;
}

/**
 * Mail của luồng tài khoản: xác minh email và đặt lại mật khẩu.
 *
 * Khác với `SecurityMailService` — bên đó chỉ báo tin và cố ý **không chứa link**. Hai loại
 * mail này bắt buộc phải có link vì đó chính là hành động người dùng vừa yêu cầu.
 */
@Injectable()
export class AccountMailService {
  private readonly logger = new Logger(AccountMailService.name);
  private readonly webOrigin: string;

  constructor(
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webOrigin = config.getOrThrow<string>('webOrigin');
  }

  async sendEmailVerification(user: Recipient, token: string): Promise<void> {
    const link = `${this.webOrigin}/xac-minh-email?token=${encodeURIComponent(token)}`;

    await this.deliver({
      user,
      link,
      subject: 'Xác minh email để kích hoạt tài khoản ReelForge',
      headline: 'Xác minh email của bạn',
      body: 'Bấm nút bên dưới để kích hoạt tài khoản. Bạn cần xác minh email trước khi đăng nhập.',
      action: 'Xác minh email',
      expiry: 'Liên kết có hiệu lực trong 24 giờ.',
    });
  }

  async sendPasswordReset(user: Recipient, token: string): Promise<void> {
    const link = `${this.webOrigin}/dat-lai-mat-khau?token=${encodeURIComponent(token)}`;

    await this.deliver({
      user,
      link,
      subject: 'Đặt lại mật khẩu ReelForge',
      headline: 'Đặt lại mật khẩu',
      body: 'Bạn vừa yêu cầu đặt lại mật khẩu. Bấm nút bên dưới để chọn mật khẩu mới.',
      action: 'Đặt lại mật khẩu',
      expiry:
        'Liên kết có hiệu lực trong 1 giờ. Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.',
    });
  }

  private async deliver(input: {
    user: Recipient;
    link: string;
    subject: string;
    headline: string;
    body: string;
    action: string;
    expiry: string;
  }): Promise<void> {
    const sent = await this.mail.send({
      to: input.user.email,
      subject: input.subject,
      text: [
        `Chào ${input.user.name},`,
        '',
        input.body,
        '',
        input.link,
        '',
        input.expiry,
        '',
        'ReelForge',
      ].join('\n'),
      html: this.render(input),
    });

    // Chưa cấu hình SMTP thì mail không đi đâu cả. In thẳng link ra log để còn thử được
    // luồng ở máy phát triển, thay vì bế tắc không hiểu vì sao không nhận được mail.
    if (!sent) {
      this.logger.warn(`[DEV] Link cho ${input.user.email}: ${input.link}`);
    }
  }

  /** HTML tối giản, style nội tuyến vì hộp thư không hỗ trợ CSS hiện đại. */
  private render(input: {
    user: Recipient;
    link: string;
    headline: string;
    body: string;
    action: string;
    expiry: string;
  }): string {
    return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
  <p style="margin:0 0 16px;font-size:14px">Chào ${escapeHtml(input.user.name)},</p>
  <h1 style="margin:0 0 12px;font-size:18px;font-weight:700">${escapeHtml(input.headline)}</h1>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6">${escapeHtml(input.body)}</p>
  <p style="margin:0 0 20px">
    <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#ff6b35;color:#10151e;font-weight:700;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(input.action)}</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#6b7280">Nếu nút không bấm được, sao chép liên kết sau vào trình duyệt:</p>
  <p style="margin:0 0 16px;font-size:12px;color:#4b5563;word-break:break-all">${escapeHtml(input.link)}</p>
  <p style="margin:0;font-size:12px;color:#6b7280">${escapeHtml(input.expiry)}</p>
  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">ReelForge</p>
</div>`;
  }
}

/** Tên người dùng do chính họ nhập nên phải escape trước khi nhúng vào HTML. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
