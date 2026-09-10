import { describe, expect, it } from 'vitest';
import { probeGif, probeMp4 } from './probe.js';

/** Dựng một box MP4 tối thiểu: 4 byte kích thước, 4 byte tên, rồi thân. */
const box = (type: string, body: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, body]);
};

/** `mvhd` phiên bản 0: version+flags(4) · created(4) · modified(4) · timescale(4) · duration(4). */
const mvhd = (timescale: number, duration: number): Buffer => {
  const body = Buffer.alloc(100);
  body.writeUInt32BE(0, 0);
  body.writeUInt32BE(timescale, 12);
  body.writeUInt32BE(duration, 16);
  return box('mvhd', body);
};

/** `tkhd` phiên bản 0 với chiều rộng/cao dạng dấu phẩy tĩnh 16.16 ở cuối. */
const tkhd = (width: number, height: number): Buffer => {
  const body = Buffer.alloc(84);
  body.writeUInt32BE(0, 0);
  body.writeUInt32BE(width * 65536, 76);
  body.writeUInt32BE(height * 65536, 80);
  return box('tkhd', body);
};

const mp4 = (timescale: number, duration: number, width = 1080, height = 1920): Buffer =>
  Buffer.concat([
    box('ftyp', Buffer.from('isomiso2avc1', 'ascii')),
    box(
      'moov',
      Buffer.concat([mvhd(timescale, duration), box('trak', tkhd(width, height))]),
    ),
  ]);

describe('probeMp4', () => {
  it('đọc đúng thời lượng và kích thước', () => {
    // 15000 đơn vị ở timescale 1000 = 15 giây.
    const info = probeMp4(mp4(1000, 15_000));

    expect(info).toEqual({ width: 1080, height: 1920, durationMs: 15_000 });
  });

  it('tính theo timescale chứ không giả định 1000', () => {
    // Timescale 600 là mặc định của rất nhiều bộ mã hoá; 9000/600 = 15 giây.
    expect(probeMp4(mp4(600, 9000))?.durationMs).toBe(15_000);
  });

  /**
   * Trả `null` chứ không đoán bừa: thời lượng quyết định số khung hình phải encode, một
   * con số bịa sẽ làm hỏng toàn bộ mốc thời gian của video.
   */
  it('từ chối dữ liệu không phải MP4', () => {
    expect(probeMp4(Buffer.from('day khong phai mp4'))).toBeNull();
  });

  it('từ chối MP4 thiếu box moov', () => {
    expect(probeMp4(box('ftyp', Buffer.from('isom', 'ascii')))).toBeNull();
  });

  it('từ chối khi timescale bằng 0, tránh chia cho 0', () => {
    expect(probeMp4(mp4(0, 15_000))).toBeNull();
  });
});

describe('probeGif', () => {
  const gif = (signature: string, width: number, height: number): Buffer => {
    const buffer = Buffer.alloc(20);
    buffer.write(signature, 0, 'ascii');
    buffer.writeUInt16LE(width, 6);
    buffer.writeUInt16LE(height, 8);
    return buffer;
  };

  it('đọc kích thước từ cả GIF87a lẫn GIF89a', () => {
    expect(probeGif(gif('GIF89a', 480, 640))).toEqual({ width: 480, height: 640 });
    expect(probeGif(gif('GIF87a', 800, 600))).toEqual({ width: 800, height: 600 });
  });

  it('từ chối file không phải GIF', () => {
    expect(probeGif(Buffer.from('PNG...'))).toBeNull();
  });
});
