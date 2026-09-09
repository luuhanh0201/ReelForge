import type { DeviceType } from "@/lib/auth-api";

/**
 * Nhãn loại thiết bị. Việc bóc User-Agent đã chuyển hẳn về máy chủ
 * (`apps/api/src/auth/device-parser.ts`): giá trị đó vừa hiển thị cho người dùng vừa là
 * căn cứ nhận diện thiết bị lạ, nên phải nằm trong database chứ không tính lại mỗi lần
 * render — và giữ nguyên kể cả khi logic bóc tách sau này đổi.
 */
export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  desktop: "Máy tính",
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Không rõ",
};

/** "3 phút trước", "2 ngày trước" — đủ để nhận ra phiên nào đang hoạt động. */
export const describeRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
};
