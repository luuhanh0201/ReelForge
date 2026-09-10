import { describe, expect, it } from 'vitest';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { readWavInfo } from './wav.js';

/** Dựng một file WAV hợp lệ, có thể chèn thêm chunk lạ trước `data`. */
const makeWav = (options: {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  dataBytes: number;
  extraChunk?: { id: string; size: number };
}): Buffer => {
  const {
    sampleRate = 24_000,
    channels = 1,
    bitsPerSample = 16,
    dataBytes,
    extraChunk,
  } = options;

  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 16);
  fmt.writeUInt16LE((channels * bitsPerSample) / 8, 20);
  fmt.writeUInt16LE(bitsPerSample, 22);

  const extra = extraChunk
    ? (() => {
        const buffer = Buffer.alloc(8 + extraChunk.size + (extraChunk.size % 2));
        buffer.write(extraChunk.id, 0, 'ascii');
        buffer.writeUInt32LE(extraChunk.size, 4);
        return buffer;
      })()
    : Buffer.alloc(0);

  const data = Buffer.alloc(8 + dataBytes);
  data.write('data', 0, 'ascii');
  data.writeUInt32LE(dataBytes, 4);

  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + fmt.length + extra.length + data.length, 4);
  header.write('WAVE', 8, 'ascii');

  return Buffer.concat([header, fmt, extra, data]);
};

describe('readWavInfo', () => {
  it('đo đúng thời lượng của một giây PCM 24kHz mono 16-bit', () => {
    const info = readWavInfo(makeWav({ dataBytes: 24_000 * 2 }));

    expect(info.durationMs).toBe(1000);
    expect(info.sampleRate).toBe(24_000);
    expect(info.channels).toBe(1);
  });

  it('tính theo số kênh, không giả định mono', () => {
    const info = readWavInfo(makeWav({ channels: 2, dataBytes: 24_000 * 2 * 2 }));

    expect(info.durationMs).toBe(1000);
  });

  /**
   * Đây là lý do phải duyệt chunk thay vì nhảy tới offset 44 cố định: WAV cho phép chèn
   * `LIST`/`fact` trước `data`, và đọc nhầm thì mọi mốc thời gian của video đều lệch.
   */
  it('bỏ qua chunk lạ nằm giữa fmt và data', () => {
    const info = readWavInfo(
      makeWav({ dataBytes: 24_000 * 2, extraChunk: { id: 'LIST', size: 26 } }),
    );

    expect(info.durationMs).toBe(1000);
    expect(info.dataBytes).toBe(24_000 * 2);
  });

  it('lấy phần nhỏ hơn khi header khai size lớn hơn dữ liệu thật', () => {
    const wav = makeWav({ dataBytes: 24_000 * 2 });
    // Bộ mã hoá ghi theo luồng đôi khi khai một size lạc quan rồi cắt sớm.
    wav.writeUInt32LE(999_999, wav.length - 24_000 * 2 - 4);

    expect(readWavInfo(wav).dataBytes).toBe(24_000 * 2);
  });

  it('từ chối dữ liệu không phải WAV thay vì trả về thời lượng bịa', () => {
    expect(() => readWavInfo(Buffer.from('ID3 day la mp3'))).toThrow(BusinessException);
  });

  it('từ chối WAV thiếu chunk data', () => {
    const wav = makeWav({ dataBytes: 100 });

    expect(() => readWavInfo(wav.subarray(0, 36))).toThrow(BusinessException);
  });
});
