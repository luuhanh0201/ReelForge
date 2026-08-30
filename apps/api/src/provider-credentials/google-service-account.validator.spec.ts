import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import {
  MAX_CREDENTIAL_FILE_BYTES,
  maskClientEmail,
  parseGoogleServiceAccount,
  privateKeyIdSuffix,
} from './google-service-account.validator.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const validAccount = {
  type: 'service_account',
  project_id: 'reelforge-dev',
  private_key_id: 'aabbccdda91f',
  private_key: pem.replace(/\n/g, '\\n'),
  client_email: 'reelforge-tts@reelforge-dev.iam.gserviceaccount.com',
  client_id: '1234567890',
};

const file = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8');

const expectCode = (input: Buffer, code: string) => {
  try {
    parseGoogleServiceAccount(input);
    throw new Error('lẽ ra phải ném lỗi');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException);
    expect((error as BusinessException).code).toBe(code);
  }
};

describe('parseGoogleServiceAccount', () => {
  it('chấp nhận file hợp lệ và chỉ giữ các field đã whitelist', () => {
    const account = parseGoogleServiceAccount(file(validAccount));

    expect(account.project_id).toBe('reelforge-dev');
    expect(account.client_email).toBe(validAccount.client_email);
    // \n đã được chuẩn hoá thành xuống dòng thật
    expect(account.private_key.includes('\n')).toBe(true);
    expect(Object.keys(account).sort()).toEqual([
      'client_email',
      'private_key',
      'private_key_id',
      'project_id',
      'type',
    ]);
  });

  it('từ chối file rỗng', () => {
    expectCode(Buffer.alloc(0), 'INVALID_SERVICE_ACCOUNT');
  });

  it('từ chối file vượt quá giới hạn', () => {
    expectCode(Buffer.alloc(MAX_CREDENTIAL_FILE_BYTES + 1, 0x20), 'PAYLOAD_TOO_LARGE');
  });

  it('từ chối JSON hỏng', () => {
    expectCode(Buffer.from('{ khong-phai-json', 'utf8'), 'INVALID_SERVICE_ACCOUNT');
  });

  it('từ chối array và null', () => {
    expectCode(file([validAccount]), 'INVALID_SERVICE_ACCOUNT');
    expectCode(file(null), 'INVALID_SERVICE_ACCOUNT');
  });

  it('từ chối type không phải service_account', () => {
    expectCode(file({ ...validAccount, type: 'authorized_user' }), 'INVALID_SERVICE_ACCOUNT');
  });

  it('từ chối khi thiếu field bắt buộc', () => {
    for (const field of ['project_id', 'private_key_id', 'private_key', 'client_email']) {
      const broken: Record<string, unknown> = { ...validAccount };
      delete broken[field];
      expectCode(file(broken), 'INVALID_SERVICE_ACCOUNT');
    }
  });

  it('từ chối client_email sai định dạng', () => {
    expectCode(file({ ...validAccount, client_email: 'khong-co-a-cong' }), 'INVALID_SERVICE_ACCOUNT');
  });

  it('từ chối private key giả', () => {
    expectCode(
      file({ ...validAccount, private_key: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n' }),
      'INVALID_SERVICE_ACCOUNT',
    );
  });

  it('không để lộ nội dung file trong thông báo lỗi', () => {
    try {
      parseGoogleServiceAccount(file({ ...validAccount, type: 'sai' }));
    } catch (error) {
      const exception = error as BusinessException;
      expect(exception.message).not.toContain(pem);
      expect(exception.details).toBeUndefined();
    }
  });
});

describe('che thông tin hiển thị', () => {
  it('che email service account', () => {
    expect(maskClientEmail('reelforge-tts@reelforge-dev.iam.gserviceaccount.com')).toBe(
      'ree***@***.iam.gserviceaccount.com',
    );
  });

  it('chỉ giữ 4 ký tự cuối của private_key_id', () => {
    expect(privateKeyIdSuffix('aabbccdda91f')).toBe('a91f');
  });
});
