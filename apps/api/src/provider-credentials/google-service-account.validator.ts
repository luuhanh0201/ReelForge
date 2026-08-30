import { createPrivateKey } from 'node:crypto';
import { BusinessException } from '../common/exceptions/business.exception.js';

/** Các field được phép giữ lại — mọi thứ khác trong file bị loại bỏ. */
export interface GoogleServiceAccount {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
}

/** Service account thật chỉ khoảng 2–3 KB; 64 KiB đã là rất rộng rãi. */
export const MAX_CREDENTIAL_FILE_BYTES = 64 * 1024;

const REQUIRED_FIELDS = [
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
] as const;

const invalid = (reason: string): BusinessException =>
  new BusinessException('INVALID_SERVICE_ACCOUNT', {
    // details để trống có chủ đích: nội dung file là dữ liệu nhạy cảm.
    message: `File service account không hợp lệ: ${reason}`,
  });

const readString = (source: Record<string, unknown>, field: string): string => {
  const value = source[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalid(`thiếu hoặc sai kiểu trường "${field}"`);
  }
  return value.trim();
};

/**
 * Parse và kiểm tra file service account.
 *
 * Không bao giờ trả về nguyên JSON gốc: chỉ dựng lại object từ các field đã whitelist,
 * để những khoá lạ trong file không đi tiếp vào SDK của Google hay vào database.
 */
export const parseGoogleServiceAccount = (file: Buffer): GoogleServiceAccount => {
  if (file.length === 0) {
    throw invalid('file rỗng');
  }

  if (file.length > MAX_CREDENTIAL_FILE_BYTES) {
    throw new BusinessException('PAYLOAD_TOO_LARGE', {
      message: `File vượt quá ${MAX_CREDENTIAL_FILE_BYTES / 1024} KiB`,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.toString('utf8')) as unknown;
  } catch {
    throw invalid('không phải JSON hợp lệ');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw invalid('nội dung phải là một object JSON');
  }

  const source = parsed as Record<string, unknown>;

  if (source.type !== 'service_account') {
    throw invalid('trường "type" phải là "service_account"');
  }

  for (const field of REQUIRED_FIELDS) {
    readString(source, field);
  }

  const clientEmail = readString(source, 'client_email');
  if (!clientEmail.includes('@')) {
    throw invalid('"client_email" không đúng định dạng email');
  }

  // File tải từ Google escape xuống dòng thành \n; PEM thật phải có xuống dòng thật.
  const privateKey = readString(source, 'private_key').replace(/\\n/g, '\n');

  try {
    createPrivateKey(privateKey);
  } catch {
    throw invalid('"private_key" không phải khoá PEM hợp lệ');
  }

  return {
    type: 'service_account',
    project_id: readString(source, 'project_id'),
    private_key_id: readString(source, 'private_key_id'),
    private_key: privateKey,
    client_email: clientEmail,
  };
};

/** "reelforge-tts@project.iam.gserviceaccount.com" -> "ree***@***.gserviceaccount.com" */
export const maskClientEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@');
  const head = local.slice(0, 3);
  const tail = domain.slice(domain.indexOf('.'));

  return `${head}***@***${tail}`;
};

export const privateKeyIdSuffix = (keyId: string): string => keyId.slice(-4);
