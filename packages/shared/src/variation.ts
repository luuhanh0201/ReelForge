import { TRANSITIONS } from "./render-config.js";

/**
 * Sinh biến thể cho mỗi lần xuất video.
 *
 * Đây không phải tính năng làm đẹp mà là **ràng buộc nghiệp vụ cốt lõi**: nền tảng phân
 * phối phạt nội dung trùng lặp, và người dùng của sản phẩm này đăng 5–15 video mỗi ngày.
 * Xuất hai lần ra hai file giống hệt nhau là tự bóp lượt hiển thị của chính họ.
 *
 * Mục tiêu là **đổi tín hiệu nhận dạng, không đổi nội dung**: người xem không nên nhận ra
 * khác biệt, còn bộ phát hiện trùng lặp của nền tảng thì có.
 *
 * Mọi giá trị phải **suy ra từ seed**, tuyệt đối không gọi `Math.random()`. Cùng một seed
 * phải cho cùng một video trên mọi máy — nếu không thì khi khách báo lỗi sẽ không dựng lại
 * được đúng file họ đang cầm.
 */

/**
 * Băm chuỗi thành số 32-bit (FNV-1a).
 *
 * Chọn FNV-1a vì nó ngắn, không phụ thuộc thư viện, và cho phân bố đủ đều cho mục đích ở
 * đây. Không dùng cho mật mã.
 */
const hash = (value: string): number => {
  let result = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }

  return result >>> 0;
};

/**
 * Bộ sinh số giả ngẫu nhiên xác định (mulberry32).
 *
 * Mỗi yếu tố biến thiên lấy một dòng số riêng bằng cách trộn tên yếu tố vào seed, nên thêm
 * một yếu tố mới không làm xê dịch những yếu tố đã có — quan trọng để một video cũ dựng
 * lại vẫn ra đúng như trước.
 */
export const createVariation = (seed: string) => {
  const next = (channel: string): number => {
    let state = (hash(`${seed}:${channel}`) + 0x6d2b79f5) >>> 0;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Số thực trong khoảng, dùng cho zoom và offset. */
    range: (channel: string, min: number, max: number): number =>
      min + next(channel) * (max - min),

    /** Chọn một phần tử. Mảng rỗng trả `undefined` để nơi gọi tự quyết định. */
    pick: <T>(channel: string, items: readonly T[]): T | undefined =>
      items.length === 0 ? undefined : items[Math.floor(next(channel) * items.length)],

    /** Số nguyên 0..bound-1, dùng cho chỉ số hướng. */
    index: (channel: string, bound: number): number =>
      Math.floor(next(channel) * bound),
  };
};

/** Bốn hướng Ken Burns; mỗi hướng là điểm nhìn bắt đầu theo tỉ lệ khung. */
export const KEN_BURNS_DIRECTIONS: readonly [number, number][] = [
  [0.5, 0.42],
  [0.5, 0.58],
  [0.42, 0.5],
  [0.58, 0.5],
];

/**
 * Năm màu nhấn nằm trong bảng màu của template.
 *
 * Đổi màu chữ đang đọc là cách rẻ nhất để đổi tín hiệu nhận dạng mà người xem không thấy
 * lạ, vì cả năm màu đều là màu nhấn hợp lý cho video bán hàng.
 */
export const ACCENT_POOL = [
  "#FF6B35",
  "#F2B237",
  "#F2545B",
  "#35C48F",
  "#FF8F50",
] as const;

export interface SceneVariation {
  /** `[x, y, zoom]` lúc bắt đầu và lúc kết thúc cảnh. */
  kenBurns: { from: [number, number, number]; to: [number, number, number] };
  transition: (typeof TRANSITIONS)[number];
}

/**
 * Biến thể của một cảnh.
 *
 * Cảnh liền nhau vẫn phải khác hướng nhau: đó là lý do chỉ số cảnh được trộn vào kênh, và
 * hướng được lệch thêm theo vị trí chẵn lẻ.
 */
export const sceneVariation = (
  variation: ReturnType<typeof createVariation>,
  position: number,
): SceneVariation => {
  const direction =
    KEN_BURNS_DIRECTIONS[
      (variation.index(`ken:${position}`, KEN_BURNS_DIRECTIONS.length) + position) %
        KEN_BURNS_DIRECTIONS.length
    ]!;

  const zoom = variation.range(`zoom:${position}`, 1.06, 1.15);
  const offset = variation.range(`crop:${position}`, -0.03, 0.03);

  // Cảnh chẵn phóng vào, cảnh lẻ lùi ra — giữ nhịp thị giác không đơn điệu.
  const zoomIn = position % 2 === 0;

  const near: [number, number, number] = [
    direction[0] + offset,
    direction[1] + offset,
    zoom,
  ];
  const far: [number, number, number] = [0.5 + offset, 0.5 + offset, 1];

  return {
    kenBurns: zoomIn ? { from: far, to: near } : { from: near, to: far },
    transition:
      variation.pick(`transition:${position}`, TRANSITIONS) ?? "fade",
  };
};

/** Tốc độ đọc lệch nhẹ quanh mức người dùng chọn; tai người gần như không phân biệt được. */
export const variedSpeed = (
  variation: ReturnType<typeof createVariation>,
  base: number,
): number => Number((base * variation.range("speed", 0.93, 1.07)).toFixed(2));
