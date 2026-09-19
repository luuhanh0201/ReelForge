import { isBlockedAddress, safeFetch, SafeFetchError } from './safe-fetch.js';

const options = {
  isHostAllowed: () => true,
  userAgent: 'test',
  accept: '*/*',
  timeoutMs: 2_000,
  maxBytes: 1024,
  maxRedirects: 2,
};

const failure = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(SafeFetchError);
  return (error as SafeFetchError).reason;
};

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'không phải IP',
  ])('chặn %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'cho qua %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe('safeFetch — chặn trước khi kết nối', () => {
  it('từ chối http', async () => {
    expect(await failure(safeFetch(new URL('http://shopee.vn/'), options))).toBe('invalid_url');
  });

  it('từ chối host ngoài allowlist', async () => {
    const guarded = { ...options, isHostAllowed: (host: string) => host === 'shopee.vn' };
    expect(await failure(safeFetch(new URL('https://example.com/'), guarded))).toBe(
      'host_not_allowed',
    );
  });

  it('từ chối IP trần, kể cả IPv6', async () => {
    expect(await failure(safeFetch(new URL('https://8.8.8.8/'), options))).toBe('host_not_allowed');
    expect(await failure(safeFetch(new URL('https://[::1]/'), options))).toBe('host_not_allowed');
  });

  it('từ chối tên miền phân giải ra địa chỉ nội bộ ngay lúc mở socket', async () => {
    expect(await failure(safeFetch(new URL('https://localhost:9/'), options))).toBe(
      'private_address',
    );
  });
});
