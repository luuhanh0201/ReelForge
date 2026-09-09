import { describe, expect, it } from 'vitest';
import {
  buildLinesFromTemplate,
  findTemplate,
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  SCRIPT_TEMPLATES,
  SECONDS_PER_LINE,
} from './script-templates.js';

const template = SCRIPT_TEMPLATES[0]!;
const product = { name: 'Bàn phím cơ Gen4', price: '1.290.000đ' };

describe('bộ mẫu kịch bản', () => {
  it('mọi mẫu đều mở bằng hook và kết bằng cta', () => {
    for (const item of SCRIPT_TEMPLATES) {
      expect(item.lines[0]!.role).toBe('hook');
      expect(item.lines[item.lines.length - 1]!.role).toBe('cta');
    }
  });

  it('mã mẫu không trùng nhau', () => {
    const codes = SCRIPT_TEMPLATES.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('tra được mẫu theo mã, mã lạ trả về undefined', () => {
    expect(findTemplate(template.code)?.label).toBe(template.label);
    expect(findTemplate('khong-ton-tai')).toBeUndefined();
  });
});

describe('buildLinesFromTemplate', () => {
  it('30 giây cho ra 3 cảnh, 60 giây cho ra 6 cảnh', () => {
    expect(buildLinesFromTemplate(template, 30, product)).toHaveLength(3);
    expect(buildLinesFromTemplate(template, 60, product)).toHaveLength(6);
  });

  it('mỗi cảnh khoảng 10 giây theo đúng độ dài mục tiêu', () => {
    for (const duration of [30, 40, 50, 60]) {
      const lines = buildLinesFromTemplate(template, duration, product);
      expect(lines).toHaveLength(duration / SECONDS_PER_LINE);
    }
  });

  /** Bỏ hook thì không ai xem hết, bỏ cta thì video không bán được gì. */
  it('luôn giữ hook đầu và cta cuối kể cả khi cắt ngắn', () => {
    const lines = buildLinesFromTemplate(template, MIN_DURATION_SEC, product);

    expect(lines[0]!.role).toBe('hook');
    expect(lines[lines.length - 1]!.role).toBe('cta');
  });

  it('kẹp độ dài vào khoảng cho phép thay vì sinh video dài vô hạn', () => {
    expect(buildLinesFromTemplate(template, 5, product)).toHaveLength(
      MIN_DURATION_SEC / SECONDS_PER_LINE,
    );
    expect(buildLinesFromTemplate(template, 600, product)).toHaveLength(
      MAX_DURATION_SEC / SECONDS_PER_LINE,
    );
  });

  it('thay tên và giá sản phẩm vào chỗ giữ chỗ', () => {
    const lines = buildLinesFromTemplate(template, 60, product);
    const all = lines.map((line) => line.text).join(' ');

    expect(all).toContain('Bàn phím cơ Gen4');
    expect(all).toContain('1.290.000đ');
  });

  /**
   * Chỗ giữ chỗ lọt ra màn hình sẽ bị người dùng đọc là lỗi hệ thống, nên thiếu dữ liệu
   * phải thay bằng chữ trung tính chứ không để nguyên dấu ngoặc nhọn.
   */
  it('thiếu tên hoặc giá thì không để lộ dấu ngoặc nhọn', () => {
    const lines = buildLinesFromTemplate(template, 60, {});
    const all = lines.map((line) => line.text).join(' ');

    expect(all).not.toContain('{');
    expect(all).not.toContain('}');
    expect(all).toContain('sản phẩm này');
  });

  it('cụm nhấn cũng được thay dữ liệu, không còn chỗ giữ chỗ', () => {
    const lines = buildLinesFromTemplate(template, 60, product);
    const emphasis = lines.flatMap((line) => line.emphasis);

    expect(emphasis.some((item) => item.includes('{'))).toBe(false);
    expect(emphasis).toContain('1.290.000đ');
  });

  it('đánh số cảnh liên tục từ 0', () => {
    const lines = buildLinesFromTemplate(template, 60, product);

    expect(lines.map((line) => line.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('cảnh mới chưa gán ảnh', () => {
    const lines = buildLinesFromTemplate(template, 30, product);

    expect(lines.every((line) => line.assetId === null)).toBe(true);
  });
});
