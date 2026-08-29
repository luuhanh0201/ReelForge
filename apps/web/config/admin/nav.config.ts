import {
  Cpu,
  FileSliders,
  KeyRound,
  LayoutDashboard,
  Mic2,
  Receipt,
  ScrollText,
  Settings,
  Shuffle,
  Users,
  Clapperboard,
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
  title: string;
  items: AdminNavItem[];
  /** Nhóm chạy bằng AI — được tô nhấn trong sidebar để phân biệt với nhóm vận hành. */
  aiPowered?: boolean;
}

export const ADMIN_BASE_PATH = "/admin";

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "overview",
    title: "Tổng quan hệ thống",
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
    title: "Hệ thống AI & Quy trình xử lý",
    aiPowered: true,
    items: [
      {
        id: "video-models",
        label: "AI Video Models",
        href: "/admin/video-models",
        icon: Clapperboard,
        badge: "Sắp ra mắt",
        comingSoon: true,
      },
      {
        id: "voice-models",
        label: "AI Voice & TTS",
        href: "/admin/voice-models",
        icon: Mic2,
        badge: "5",
      },
      {
        id: "script-models",
        label: "AI Script & Hook",
        href: "/admin/script-models",
        icon: FileSliders,
        badge: "4",
      },
      {
        id: "orchestrator",
        label: "Điều phối & Phân luồng",
        href: "/admin/orchestrator",
        icon: Shuffle,
      },
    ],
  },
  {
    id: "accounts",
    title: "Tài khoản & Thanh toán",
    items: [
      {
        id: "users",
        label: "Quản trị người dùng",
        href: "/admin/users",
        icon: Users,
        badge: "1.840",
      },
      {
        id: "transactions",
        label: "Giao dịch & Đối soát",
        href: "/admin/transactions",
        icon: Receipt,
        badge: "12",
      },
    ],
  },
  {
    id: "infra",
    title: "Hạ tầng & Kiểm toán",
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
        badge: "3",
      },
      {
        id: "api-keys",
        label: "API Keys & Webhooks",
        href: "/admin/api-keys",
        icon: KeyRound,
        badge: "2",
      },
      {
        id: "logs",
        label: "Nhật ký hệ thống",
        href: "/admin/logs",
        icon: ScrollText,
      },
      {
        id: "settings",
        label: "Cài đặt chung",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

export const ADMIN_BRAND = {
  title: "ReelForge Admin",
  subtitle: "AI Command Center",
  icon: Cpu,
  operator: { name: "Minh Anh", role: "Super Admin", initial: "M" },
} as const;
