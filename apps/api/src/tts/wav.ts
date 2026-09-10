import { BusinessException } from '../common/exceptions/business.exception.js';

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Số byte của riêng phần PCM, không tính header. */
  dataBytes: number;
  durationMs: number;
}

/**
 * Đọc thông số từ header WAV mà Google trả về cho `LINEAR16`.
 *
 * Vì sao phải làm việc này thay vì ước lượng theo số ký tự: **thời lượng thật của câu là
 * thứ quyết định mọi mốc thời gian phía sau** — độ dài cảnh, mốc sáng của từng từ trong
 * phụ đề, vị trí ghép tiếng trong file MP4. Sai một chút ở đây thì chữ lệch tiếng suốt cả
 * video, và người dùng không có cách nào sửa.
 *
 * Không duyệt chunk mù quáng theo offset cố định: WAV cho phép chèn thêm chunk (`LIST`,
 * `fact`) trước `data`, nên phải đi lần lượt.
 */
export const readWavInfo = (buffer: Buffer): WavInfo => {
  const fail = (reason: string): never => {
    throw new BusinessException('GOOGLE_TTS_UNAVAILABLE', {
      message: `Dữ liệu âm thanh trả về không đọc được (${reason})`,
    });
  };

  if (buffer.length < 12) fail('quá ngắn');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') fail('thiếu RIFF');
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') fail('thiếu WAVE');

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;

  let cursor = 12;

  while (cursor + 8 <= buffer.length) {
    const id = buffer.toString('ascii', cursor, cursor + 4);
    const size = buffer.readUInt32LE(cursor + 4);
    const body = cursor + 8;

    if (id === 'fmt ' && body + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bitsPerSample = buffer.readUInt16LE(body + 14);
    } else if (id === 'data') {
      // Một số bộ mã hoá ghi size lớn hơn dữ liệu thật khi ghi theo luồng; lấy phần nhỏ hơn.
      dataBytes = Math.min(size, buffer.length - body);
      break;
    }

    // Chunk luôn căn theo bội số của 2.
    cursor = body + size + (size % 2);
  }

  if (channels === 0 || sampleRate === 0 || bitsPerSample === 0) fail('thiếu chunk fmt');
  if (dataBytes === 0) fail('thiếu chunk data');

  const bytesPerFrame = channels * (bitsPerSample / 8);

  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationMs: Math.round((dataBytes / bytesPerFrame / sampleRate) * 1000),
  };
};
