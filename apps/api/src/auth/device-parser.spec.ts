import { describe, expect, it } from 'vitest';
import { describeDevice, deviceKey, parseDevice } from './device-parser.js';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAFARI_IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1';

describe('parseDevice', () => {
  it('nhận ra Chrome trên Windows là máy tính', () => {
    expect(parseDevice(CHROME_WINDOWS)).toEqual({
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
    });
  });

  it('nhận ra Safari trên iPhone là điện thoại', () => {
    expect(parseDevice(SAFARI_IPHONE)).toEqual({
      browser: 'Safari',
      os: 'iOS',
      deviceType: 'mobile',
    });
  });

  /**
   * User-Agent của Edge chứa cả "Chrome" lẫn "Safari" — thứ tự nhận diện sai thì mọi máy
   * Edge sẽ bị ghi nhầm thành Chrome và không bao giờ bị coi là thiết bị lạ.
   */
  it('không nhầm Edge thành Chrome', () => {
    expect(parseDevice(EDGE_WINDOWS).browser).toBe('Edge');
  });

  it('Chrome trên Android là điện thoại, không phải máy tính', () => {
    expect(parseDevice(CHROME_ANDROID)).toEqual({
      browser: 'Chrome',
      os: 'Android',
      deviceType: 'mobile',
    });
  });

  it('iPad là máy tính bảng chứ không phải điện thoại', () => {
    expect(parseDevice(SAFARI_IPAD).deviceType).toBe('tablet');
  });

  it('không có User-Agent thì trả về giá trị rỗng chứ không đoán bừa', () => {
    expect(parseDevice(null)).toEqual({
      browser: null,
      os: null,
      deviceType: 'unknown',
    });
  });
});

describe('deviceKey', () => {
  it('cùng trình duyệt và hệ điều hành thì cùng một khoá dù loại thiết bị khác', () => {
    expect(deviceKey(parseDevice(CHROME_WINDOWS))).toBe(
      deviceKey({ browser: 'Chrome', os: 'Windows', deviceType: 'unknown' }),
    );
  });

  it('trình duyệt khác nhau trên cùng máy là hai thiết bị khác nhau', () => {
    expect(deviceKey(parseDevice(CHROME_WINDOWS))).not.toBe(
      deviceKey(parseDevice(EDGE_WINDOWS)),
    );
  });

  it('User-Agent rỗng vẫn cho ra khoá ổn định, không phải chuỗi rỗng', () => {
    expect(deviceKey(parseDevice(null))).toBe('unknown|unknown');
  });
});

describe('describeDevice', () => {
  it('ghép tên đọc được cho người dùng', () => {
    expect(describeDevice(parseDevice(CHROME_WINDOWS))).toBe('Chrome trên Windows');
  });

  it('thiếu một vế thì dùng vế còn lại', () => {
    expect(
      describeDevice({ browser: null, os: 'Windows', deviceType: 'desktop' }),
    ).toBe('Windows');
  });

  it('không biết gì thì nói thẳng là không xác định', () => {
    expect(describeDevice(parseDevice(null))).toBe('Thiết bị không xác định');
  });
});
