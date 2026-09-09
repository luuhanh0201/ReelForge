import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

/** Các loại cảnh báo bảo mật gửi tới chủ tài khoản. */
export type SecurityAlert =
  | { kind: 'new_device' }
  | { kind: 'token_reuse' }
  | { kind: 'logout_all'; sessions: number }
  | { kind: 'admin_revoke'; sessions: number }
  | { kind: 'account_suspended' };

export interface SecurityAlertContext {
  email: string;
  name: string;
  device: string;
  ip: string | null;
  at: Date;
}

const COPY: Record<
  SecurityAlert['kind'],
  { subject: string; headline: string; body: string }
> = {
  new_device: {
    subject: 'Có thiết bị mới đăng nhập vào tài khoản ReelForge của bạn',
    headline: 'Đăng nhập từ thiết bị mới',
    body: 'Tài khoản của bạn vừa được đăng nhập từ một thiết bị chưa từng dùng trước đây.',
  },
  token_reuse: {
    subject: 'Cảnh báo bảo mật: phiên đăng nhập ReelForge bị dùng lại bất thường',
    headline: 'Phát hiện dấu hiệu phiên bị đánh cắp',
    body: 'Một phiên đăng nhập cũ vừa được dùng lại theo cách bất thường. Chúng tôi đã đóng phiên đó ngay để bảo vệ tài khoản.',
  },
  logout_all: {
    subject: 'Tài khoản ReelForge của bạn đã đăng xuất khỏi mọi thiết bị',
    headline: 'Đã đăng xuất khỏi mọi thiết bị',
    body: 'Toàn bộ thiết bị đang đăng nhập vào tài khoản của bạn vừa bị đăng xuất.',
  },
  admin_revoke: {
    subject: 'Phiên đăng nhập ReelForge của bạn đã bị quản trị viên thu hồi',
    headline: 'Quản trị viên đã thu hồi phiên đăng nhập',
    body: 'Quản trị viên ReelForge vừa đóng toàn bộ phiên đăng nhập của tài khoản bạn.',
  },
  account_suspended: {
    subject: 'Tài khoản ReelForge của bạn đã bị khoá',
    headline: 'Tài khoản đã bị khoá',
    body: 'Tài khoản của bạn vừa bị khoá và đã bị đăng xuất khỏi mọi thiết bị.',
  },
};

const formatTime = (at: Date): string =>
  at.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

/**
 * Soạn và gửi cảnh báo bảo mật cho chủ tài khoản.
 *
 * Nội dung cố ý **không kèm bất kỳ liên kết đăng nhập nào** — mail cảnh báo bảo mật mà
 * chứa link bấm vào là dạy người dùng thói quen đúng bằng thứ kẻ lừa đảo cần. Người dùng
 * được hướng dẫn tự mở trang thiết bị từ trình duyệt của họ.
 */
@Injectable()
export class SecurityMailService {
  private readonly webOrigin: string;

  constructor(
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webOrigin = config.getOrThrow<string>('webOrigin');
  }

  async notify(
    alert: SecurityAlert,
    context: SecurityAlertContext,
  ): Promise<void> {
    const copy = COPY[alert.kind];
    const when = formatTime(context.at);
    const where = context.ip ?? 'không rõ';

    const details = [
      `Thiết bị: ${context.device}`,
      `Địa chỉ IP: ${where}`,
      `Thời gian: ${when}`,
      ...('sessions' in alert ? [`Số phiên bị đóng: ${alert.sessions}`] : []),
    ];

    const action =
      alert.kind === 'account_suspended'
        ? 'Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ đội ngũ ReelForge.'
        : `Nếu đây đúng là bạn, có thể bỏ qua email này. Nếu không phải, hãy tự mở ${this.webOrigin}/account/sessions trên trình duyệt của bạn và thu hồi các thiết bị lạ.`;

    await this.mail.send({
      to: context.email,
      subject: copy.subject,
      text: [
        `Chào ${context.name},`,
        '',
        copy.body,
        '',
        ...details,
        '',
        action,
        '',
        'ReelForge',
      ].join('\n'),
      html: this.renderHtml(copy.headline, copy.body, details, action, context.name),
    });
  }

  /** HTML tối giản, dùng bảng và style nội tuyến vì hộp thư không hỗ trợ CSS hiện đại. */
  private renderHtml(
    headline: string,
    body: string,
    details: string[],
    action: string,
    name: string,
  ): string {
    const rows = details
      .map(
        (line) =>
          `<tr><td style="padding:4px 0;color:#4b5563;font-size:14px">${escapeHtml(line)}</td></tr>`,
      )
      .join('');

    return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
  <p style="margin:0 0 16px;font-size:14px">Chào ${escapeHtml(name)},</p>
  <h1 style="margin:0 0 12px;font-size:18px;font-weight:700">${escapeHtml(headline)}</h1>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(body)}</p>
  <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;padding:12px">
    ${rows}
  </table>
  <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#4b5563">${escapeHtml(action)}</p>
  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">ReelForge</p>
</div>`;
  }
}

/** Tên người dùng đến từ Google nên phải escape trước khi nhúng vào HTML. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
