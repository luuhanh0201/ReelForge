export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceInfo {
  browser: string | null;
  os: string | null;
  deviceType: DeviceType;
}

/**
 * Thứ tự có ý nghĩa: chuỗi User-Agent của Edge chứa cả "Chrome" và "Safari", của Chrome
 * chứa "Safari". Trình duyệt đặc thù phải đứng trước trình duyệt phổ quát hơn.
 */
const BROWSERS: [RegExp, string][] = [
  [/edg[ea]?\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/samsungbrowser/i, 'Samsung Internet'],
  [/coc_coc_browser/i, 'Cốc Cốc'],
  [/chrome|crios/i, 'Chrome'],
  [/firefox|fxios/i, 'Firefox'],
  [/safari/i, 'Safari'],
];

const OPERATING_SYSTEMS: [RegExp, string][] = [
  [/iphone|ipad|ipod/i, 'iOS'],
  [/android/i, 'Android'],
  [/windows/i, 'Windows'],
  [/mac os x|macintosh/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

const firstMatch = (value: string, table: [RegExp, string][]): string | null =>
  table.find(([pattern]) => pattern.test(value))?.[1] ?? null;

const detectDeviceType = (userAgent: string): DeviceType => {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return 'tablet';
  // "Mobi" xuất hiện trong UA của mọi trình duyệt di động chính.
  if (/mobi|iphone|ipod|android.*mobile/i.test(userAgent)) return 'mobile';
  if (/windows|macintosh|linux|cros|android/i.test(userAgent)) return 'desktop';

  return 'unknown';
};

/**
 * Bóc User-Agent thành thông tin thiết bị để lưu lại.
 *
 * Bóc **ở phía máy chủ** thay vì để giao diện tự đọc: giá trị này vừa hiển thị cho người
 * dùng, vừa là căn cứ nhận diện thiết bị lạ, nên phải nằm trong database chứ không thể
 * tính lại mỗi lần render — và phải giữ nguyên kể cả khi sau này logic bóc tách đổi.
 */
export const parseDevice = (userAgent: string | null): DeviceInfo => {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: 'unknown' };
  }

  return {
    browser: firstMatch(userAgent, BROWSERS),
    os: firstMatch(userAgent, OPERATING_SYSTEMS),
    deviceType: detectDeviceType(userAgent),
  };
};

/**
 * Khoá nhận diện thiết bị: **chỉ trình duyệt + hệ điều hành**, cố ý bỏ qua IP.
 *
 * IP của nhà mạng Việt Nam đổi liên tục (wifi sang 4G, khởi động lại router), lấy IP làm
 * căn cứ sẽ sinh cảnh báo mỗi ngày cho cùng một người — và cảnh báo nhiều đến mức bị bỏ
 * qua thì cảnh báo thật cũng chìm theo.
 */
export const deviceKey = (device: DeviceInfo): string =>
  `${device.browser ?? 'unknown'}|${device.os ?? 'unknown'}`;

/** Tên thiết bị cho người đọc: "Chrome trên Windows". */
export const describeDevice = (device: DeviceInfo): string => {
  if (device.browser && device.os) return `${device.browser} trên ${device.os}`;
  return device.browser ?? device.os ?? 'Thiết bị không xác định';
};
