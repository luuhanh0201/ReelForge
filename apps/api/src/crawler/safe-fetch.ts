import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

/**
 * Tải một URL do người dùng cung cấp mà không mở đường cho SSRF.
 *
 * Không dùng `fetch` có sẵn vì hai việc nó không cho làm:
 *
 * - **Kiểm tra IP ngay lúc kết nối.** Kiểm DNS trước rồi mới `fetch` là để hở một khe:
 *   tên miền có thể trả IP công khai cho lần hỏi đầu và `127.0.0.1` cho lần kết nối thật
 *   (DNS rebinding). Ở đây `lookup` của chính socket từ chối IP nội bộ, nên không có khe.
 * - **Kiểm tra lại host ở từng bước redirect.** Link rút gọn hợp lệ hoàn toàn có thể
 *   chuyển hướng tới một địa chỉ nội bộ.
 */
export type SafeFetchFailure =
  | 'invalid_url'
  | 'host_not_allowed'
  | 'private_address'
  | 'too_many_redirects'
  | 'too_large'
  | 'timeout'
  | 'http_status'
  | 'network';

export class SafeFetchError extends Error {
  constructor(
    readonly reason: SafeFetchFailure,
    message: string,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  isHostAllowed: (host: string) => boolean;
  userAgent: string;
  accept: string;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
}

export interface SafeFetchResult {
  /** URL cuối cùng sau mọi redirect. */
  url: URL;
  contentType: string;
  body: Buffer;
}

const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** IP không được phép kết nối: loopback, mạng riêng, link-local, multicast… */
export function isBlockedAddress(address: string): boolean {
  const mapped = IPV4_MAPPED.exec(address);
  if (mapped?.[1]) return BLOCKED.check(mapped[1], 'ipv4');

  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, 'ipv4');
  if (family === 6) return BLOCKED.check(address, 'ipv6');

  return true;
}

/** `lookup` cho socket: phân giải như thường, rồi từ chối nếu có IP nào bị chặn. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) {
      callback(error, '', 0);
      return;
    }

    const [first] = addresses;

    if (!first || addresses.some((item) => isBlockedAddress(item.address))) {
      callback(new SafeFetchError('private_address', `${hostname} trỏ tới địa chỉ nội bộ`), '', 0);
      return;
    }

    if (options.all) {
      callback(null, addresses);
      return;
    }

    callback(null, first.address, first.family);
  });
};

/** Đếm byte đã giải nén, cắt ngang khi vượt trần — chặn cả file thật lớn lẫn "bom nén". */
class ByteLimit extends Transform {
  private received = 0;
  readonly chunks: Buffer[] = [];

  constructor(private readonly maxBytes: number) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    this.received += chunk.length;

    if (this.received > this.maxBytes) {
      done(new SafeFetchError('too_large', `Dữ liệu vượt quá ${this.maxBytes} byte`));
      return;
    }

    this.chunks.push(chunk);
    done();
  }
}

function decoderFor(encoding: string | undefined) {
  switch (encoding?.trim().toLowerCase()) {
    case 'gzip':
    case 'x-gzip':
      return createGunzip();
    case 'br':
      return createBrotliDecompress();
    case 'deflate':
      return createInflate();
    default:
      return null;
  }
}

function openOnce(url: URL, options: SafeFetchOptions): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        lookup: guardedLookup,
        timeout: options.timeoutMs,
        headers: {
          'User-Agent': options.userAgent,
          Accept: options.accept,
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      resolve,
    );

    req.on('timeout', () => {
      req.destroy(new SafeFetchError('timeout', `Quá ${options.timeoutMs}ms không phản hồi`));
    });
    req.on('error', (error) => {
      reject(
        error instanceof SafeFetchError ? error : new SafeFetchError('network', error.message),
      );
    });
    req.end();
  });
}

async function readBody(
  response: IncomingMessage,
  options: SafeFetchOptions,
): Promise<Buffer> {
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > options.maxBytes) {
    response.destroy();
    throw new SafeFetchError('too_large', `Dữ liệu vượt quá ${options.maxBytes} byte`);
  }

  const limit = new ByteLimit(options.maxBytes);
  const decoder = decoderFor(response.headers['content-encoding']);
  // Hết giờ cả lúc đang đọc thân, không chỉ lúc chờ header: máy chủ nhỏ giọt từng byte vẫn
  // giữ được kết nối vô hạn nếu chỉ có timeout của socket.
  const signal = AbortSignal.timeout(options.timeoutMs);

  try {
    if (decoder) {
      await pipeline(response, decoder, limit, { signal });
    } else {
      await pipeline(response, limit, { signal });
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) {
      throw new SafeFetchError('timeout', `Quá ${options.timeoutMs}ms khi đọc dữ liệu`);
    }
    throw new SafeFetchError('network', error instanceof Error ? error.message : String(error));
  }

  return Buffer.concat(limit.chunks);
}

export async function safeFetch(
  input: URL,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  let url = input;

  for (let hop = 0; hop <= options.maxRedirects; hop += 1) {
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new SafeFetchError('invalid_url', `Không nhận URL ${url.protocol}`);
    }
    if (!options.isHostAllowed(url.hostname)) {
      throw new SafeFetchError('host_not_allowed', `Không được phép tải từ ${url.hostname}`);
    }
    if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) {
      // Tên miền trong allowlist không bao giờ là IP trần; chặn luôn để khỏi phải suy luận.
      throw new SafeFetchError('host_not_allowed', 'Không nhận địa chỉ IP trực tiếp');
    }

    const response = await openOnce(url, options);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;

    if (status >= 300 && status < 400 && location) {
      response.resume();
      try {
        url = new URL(location, url);
      } catch {
        throw new SafeFetchError('invalid_url', 'Redirect tới URL không hợp lệ');
      }
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      throw new SafeFetchError('http_status', `Máy chủ trả HTTP ${status}`);
    }

    return {
      url,
      contentType: String(response.headers['content-type'] ?? ''),
      body: await readBody(response, options),
    };
  }

  throw new SafeFetchError('too_many_redirects', `Quá ${options.maxRedirects} lần chuyển hướng`);
}
