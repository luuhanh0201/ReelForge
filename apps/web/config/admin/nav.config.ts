import {
  Cpu,
  Sparkles,
  Compass,
  LayoutTemplate,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  Users,
  Database,
  HardDrive,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Huy hiệu đếm hiển thị cạnh mục menu. */
  badge?: string;
  /** Mục chưa mở — hiển thị nhưng gắn nhãn roadmap. */
  comingSoon?: boolean;
}

export interface AdminNavGroup {
  id: string;
  /** Vắng mặt = nhóm không có tiêu đề (và vì thế không thu gọn được). */
  title?: string;
  items: AdminNavItem[];
  /** Nhóm chạy bằng AI — được tô nhấn trong sidebar để phân biệt với nhóm vận hành. */
  aiPowered?: boolean;
  /** Huy hiệu nhỏ cạnh tiêu đề nhóm. */
  badge?: string;
  /** Dính đáy sidebar — dành cho mục vào hiếm như Cài đặt. */
  pinBottom?: boolean;
}

export const ADMIN_BASE_PATH = "/admin";

/**
 * Menu admin, xếp theo **tần suất dùng thật**: vận hành hằng ngày trước, nội dung ở giữa,
 * hạ tầng sau, cài đặt dính đáy.
 *
 * Nhóm một mục thì bỏ tiêu đề — trước đây 5 tiêu đề cho 14 mục, trong đó hai nhóm đầu mỗi
 * nhóm đúng một mục, nên tiêu đề gần nhiều bằng nội dung. Ngoại lệ là nhóm AI: tiêu đề ở đó
 * mang phần tô nhấn, cố ý giữ.
 *
 * **Badge phải là số thật.** Số "12 giao dịch" và "3 job Redis" trước đây là hằng số trong
 * config, nhìn vào tưởng có việc đang chờ xử lý — đã gỡ. Chỉ còn badge người dùng, do
 * `/admin/users/stats` trả về.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "overview",
    items: [
      {
        id: "overview",
        label: "Bảng điều khiển",
        href: "/admin/overview",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "ai",
    title: "Hệ thống AI",
    aiPowered: true,
    items: [
      {
        id: "ai",
        label: "AI & Model",
        href: "/admin/ai",
        icon: Sparkles,
      },
    ],
  },
  {
    id: "operate",
    title: "Vận hành",
    items: [
      {
        id: "users",
        label: "Người dùng & Thiết bị",
        href: "/admin/users",
        icon: Users,
      },
      {
        id: "transactions",
        label: "Giao dịch & Đối soát",
        href: "/admin/transactions",
        icon: Receipt,
      },
    ],
  },
  {
    id: "content",
    title: "Nội dung",
    badge: "CMS Live",
    items: [
      {
        id: "landing",
        label: "Landing Page",
        href: "/admin/landing",
        icon: LayoutTemplate,
      },
      {
        id: "tours",
        label: "Tour hướng dẫn",
        href: "/admin/tours",
        icon: Compass,
      },
    ],
  },
  {
    id: "infra",
    title: "Hạ tầng",
    items: [
      {
        id: "database",
        label: "Cơ sở dữ liệu",
        href: "/admin/database",
        icon: Database,
      },
      {
        id: "redis",
        label: "Redis & Hàng đợi",
        href: "/admin/redis",
        icon: HardDrive,
      },
      {
        id: "logs",
        label: "Nhật ký hệ thống",
        href: "/admin/logs",
        icon: ScrollText,
      },
    ],
  },
  {
    id: "settings",
    pinBottom: true,
    items: [
      {
        id: "settings",
        label: "Cài đặt chung",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

/** Danh tính người quản trị **không** nằm ở đây — sidebar lấy thẳng từ phiên đăng nhập. */
export const ADMIN_BRAND = {
  title: "ReelForge Admin",
  subtitle: "AI Command Center",
  icon: Cpu,
} as const;
