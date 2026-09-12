import { describe, expect, it } from "vitest";
import { normalizeSpeech, speechChanged } from "./speech.js";

/**
 * Các trường hợp dưới đây lấy thẳng từ bảng phân loại ở mục 5.4 và 8.5 của tài liệu thiết
 * kế. Mỗi dòng "không đổi" mà bị nhận nhầm thành "đã đổi" là một lượt hạn mức bị đốt và
 * vài giây chờ vô ích cho người dùng.
 */
describe("speechChanged — những sửa đổi KHÔNG cần đọc lại", () => {
  const unchanged: [string, string, string][] = [
    ["viết hoa lại", "bàn phím cơ rất bền", "Bàn phím cơ rất bền"],
    ["thêm dấu chấm than", "Sản phẩm này rất tốt", "Sản phẩm này rất tốt!"],
    ["thêm dấu phẩy", "Mình dùng hai tuần rồi và thấy ổn", "Mình dùng hai tuần rồi, và thấy ổn"],
    ["chèn emoji", "Giá chỉ 199k", "Giá chỉ 199k 🔥"],
    ["đổi cách ngắt dòng", "Mình đã dùng\nsản phẩm này", "Mình đã dùng sản phẩm này"],
    ["thừa khoảng trắng", "Mua  ngay   hôm nay", "Mua ngay hôm nay"],
    ["thêm ba chấm", "Bạn xem thử nhé", "Bạn xem thử nhé..."],
  ];

  for (const [label, before, after] of unchanged) {
    it(label, () => {
      expect(speechChanged(before, after)).toBe(false);
    });
  }
});

describe("speechChanged — những sửa đổi PHẢI đọc lại", () => {
  const changed: [string, string, string][] = [
    ["đổi thứ tự từ", "không mỏi tay", "tay không mỏi"],
    ["thêm một cụm", "Sản phẩm tốt", "Sản phẩm rất tốt"],
    ["bớt một từ", "Mình đã dùng thử rồi", "Mình đã dùng rồi"],
    ["đổi số", "Giá chỉ 199k", "Giá chỉ 299k"],
    ["đổi dấu tiếng Việt", "cái mà bạn cần", "cái ma bạn cần"],
  ];

  for (const [label, before, after] of changed) {
    it(label, () => {
      expect(speechChanged(before, after)).toBe(true);
    });
  }
});

describe("normalizeSpeech", () => {
  it("giữ nguyên dấu tiếng Việt vì chúng đổi cách đọc", () => {
    expect(normalizeSpeech("Mà")).toBe("mà");
    expect(normalizeSpeech("Ma")).not.toBe(normalizeSpeech("Mà"));
  });

  it("giữ chữ số vì chúng được đọc thành lời", () => {
    expect(normalizeSpeech("giảm 50%")).toBe("giảm 50");
  });

  it("chuỗi chỉ có dấu câu quy về rỗng", () => {
    expect(normalizeSpeech("!!! ... ???")).toBe("");
  });
});
