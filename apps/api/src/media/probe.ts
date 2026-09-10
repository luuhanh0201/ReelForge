/**
 * Đọc thông số của video và GIF **mà không cần ffmpeg**.
 *
 * Vì sao không tin dữ liệu do trình duyệt gửi lên: thời lượng quyết định độ dài cảnh, và
 * độ dài cảnh quyết định số khung hình phải encode. Một con số bịa sẽ làm hỏng toàn bộ mốc
 * thời gian của video, hoặc bắt máy chủ tính cho một video 10 tiếng.
 *
 * Chỉ đọc đúng phần header cần thiết — cả hai định dạng đều đặt thông số ở đầu file.
 */

export interface VideoInfo {
  width: number;
  height: number;
  durationMs: number;
}

/** Duyệt cây box của MP4 để tìm một box theo đường dẫn, ví dụ `moov/mvhd`. */
const findBox = (
  buffer: Buffer,
  path: string[],
  start = 0,
  end = buffer.length,
): { offset: number; size: number } | null => {
  const [wanted, ...rest] = path;
  if (!wanted) return null;

  let cursor = start;

  while (cursor + 8 <= end) {
    const size = buffer.readUInt32BE(cursor);
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);

    // size 0 nghĩa là "tới hết file"; size 1 nghĩa là kích thước 64-bit ở 8 byte kế tiếp.
    const realSize =
      size === 0 ? end - cursor : size === 1 ? Number(buffer.readBigUInt64BE(cursor + 8)) : size;

    if (realSize < 8) return null;

    if (type === wanted) {
      const body = cursor + (size === 1 ? 16 : 8);
      return rest.length === 0
        ? { offset: body, size: realSize }
        : findBox(buffer, rest, body, cursor + realSize);
    }

    cursor += realSize;
  }

  return null;
};

/**
 * Thời lượng và kích thước của MP4.
 *
 * `mvhd` cho thời lượng toàn phim, `tkhd` của track hình cho kích thước hiển thị. Trả
 * `null` khi không đọc được — nơi gọi phải coi đó là file không hợp lệ chứ không đoán bừa.
 */
export const probeMp4 = (buffer: Buffer): VideoInfo | null => {
  const mvhd = findBox(buffer, ['moov', 'mvhd']);
  if (!mvhd) return null;

  const version = buffer.readUInt8(mvhd.offset);

  const { timescale, duration } =
    version === 1
      ? {
          timescale: buffer.readUInt32BE(mvhd.offset + 20),
          duration: Number(buffer.readBigUInt64BE(mvhd.offset + 24)),
        }
      : {
          timescale: buffer.readUInt32BE(mvhd.offset + 12),
          duration: buffer.readUInt32BE(mvhd.offset + 16),
        };

  if (!timescale || !duration) return null;

  // `tkhd` nằm trong `moov/trak`; track đầu tiên có kích thước khác 0 là track hình.
  const trak = findBox(buffer, ['moov', 'trak', 'tkhd']);
  let width = 0;
  let height = 0;

  if (trak) {
    const tkhdVersion = buffer.readUInt8(trak.offset);
    /*
     * Chiều rộng và cao là hai trường **cuối cùng** của `tkhd`, dạng dấu phẩy tĩnh 16.16.
     * Vị trí của chúng phụ thuộc phiên bản vì các mốc thời gian dài 8 byte thay vì 4:
     *   v0: 4 cờ + 4 tạo + 4 sửa + 4 id + 4 dự trữ + 4 thời lượng + 8 dự trữ
     *       + 2 lớp + 2 nhóm + 2 âm lượng + 2 dự trữ + 36 ma trận = 76
     *   v1: cùng thứ tự nhưng tạo/sửa/thời lượng là 8 byte           = 88
     */
    const base = trak.offset + (tkhdVersion === 1 ? 88 : 76);
    if (base + 8 <= buffer.length) {
      width = Math.round(buffer.readUInt32BE(base) / 65536);
      height = Math.round(buffer.readUInt32BE(base + 4) / 65536);
    }
  }

  return {
    width,
    height,
    durationMs: Math.round((duration / timescale) * 1000),
  };
};

/**
 * Kích thước của GIF.
 *
 * Không đo thời lượng: GIF tự lặp vô hạn, và ở đây người dùng là người quyết định cảnh dài
 * bao nhiêu — giống hệt ảnh tĩnh.
 */
export const probeGif = (buffer: Buffer): { width: number; height: number } | null => {
  if (buffer.length < 10) return null;

  const signature = buffer.toString('ascii', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
};
