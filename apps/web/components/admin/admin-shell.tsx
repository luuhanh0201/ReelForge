"use client";

import {
  ArrowLeft,
  Loader2,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Search,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ROLE_LABEL } from "@/config/admin/accounts.config";
import { ADMIN_BRAND, ADMIN_NAV } from "@/config/admin/nav.config";
import { useApp } from "@/lib/app-provider";
import { isStaff, USER_HOME } from "@/lib/auth-api";
import { L } from "@/lib/i18n";
import { AdminInput } from "@/components/admin/primitives";
import { ToastProvider } from "@/components/admin/toast";
import { AuthModal } from "@/components/auth/auth-modal";
import { StatusScreen } from "@/components/layout/status-screen";

/**
 * Khung admin: sidebar cố định 280px + vùng nội dung cuộn độc lập.
 * Sidebar co gọn thành overlay dưới 1280px (laptop nhỏ / tablet).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, user, authLoading, openAuth, signOut } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const BrandIcon = ADMIN_BRAND.icon;

  // Chờ biết được người dùng là ai rồi mới quyết định — nếu không, khung admin sẽ loé
  // lên một nhịp trước khi bị thay bằng màn hình 403.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 size={22} className="animate-spin text-brand" />
      </div>
    );
  }

  /*
   * Chốt chặn ở tầng giao diện cho người không có quyền. Đây **không phải** lớp bảo vệ
   * dữ liệu: mọi endpoint `/admin/*` của API đã tự đòi vai nội bộ, kể cả khi ai đó gọi
   * thẳng bằng curl.
   */
  if (!isStaff(user)) {
    return (
      <>
        <StatusScreen
          status="forbidden"
          title={L("Khu vực quản trị nội bộ", "Internal admin area")}
          description={
            user
              ? L(
                  "Tài khoản của bạn không có quyền vào khu quản trị. Liên hệ quản trị viên nếu bạn cần quyền truy cập.",
                  "Your account does not have admin access. Contact an administrator if you need it.",
                )
              : L(
                  "Trang này chỉ dành cho tài khoản nội bộ của ReelForge. Đăng nhập bằng tài khoản có quyền quản trị để tiếp tục.",
                  "This area is for ReelForge staff accounts. Sign in with an account that has admin access.",
                )
          }
          // Đã đăng nhập nhưng không đủ quyền thì lối ra là khu vực của họ, không phải
          // mời đăng nhập lại bằng chính tài khoản vừa bị từ chối.
          primaryLabel={
            user ? L("Vào Studio", "Open Studio") : undefined
          }
          onPrimary={
            user
              ? () => router.push(USER_HOME)
              : () => openAuth("signin", pathname)
          }
        />
        <AuthModal />
      </>
    );
  }

  const sidebar = (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-brand text-[#10151e]">
          <BrandIcon size={20} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-ink">
            {ADMIN_BRAND.title}
          </p>
          <p className="truncate text-[11px] text-muted">{ADMIN_BRAND.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Đóng menu"
          className="ml-auto rounded-btn p-1 text-muted transition-colors hover:text-ink xl:hidden"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {ADMIN_NAV.map((group) => (
          <div
            key={group.id}
            className={`mb-5 last:mb-0 ${
              group.aiPowered ? "rounded-card border border-brand/25 bg-brand/[0.06] p-2" : ""
            }`}
          >
            <p
              className={`flex flex-wrap items-center gap-1.5 px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] ${
                group.aiPowered ? "text-brand" : "text-muted"
              }`}
            >
              {group.title}

              {/* Huy hiệu nhóm, ví dụ "CMS Live" của nhóm Landing Page. */}
              {group.badge ? (
                <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-[#10151e]">
                  {group.badge}
                </span>
              ) : null}
            </p>

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 whitespace-nowrap rounded-btn px-2.5 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-brand/12 text-brand"
                          : group.aiPowered
                            ? "text-ink hover:bg-brand/10"
                            : "text-muted hover:bg-subtle hover:text-ink"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 ${
                          !active && group.aiPowered ? "text-brand/70" : ""
                        }`}
                      />
                      <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={`ml-auto shrink-0 rounded-btn px-1.5 py-0.5 text-[10px] font-bold ${
                            item.comingSoon
                              ? "bg-subtle text-muted"
                              : "bg-brand/15 text-brand"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Danh tính người đang đăng nhập — lấy thẳng từ phiên, không phải chỗ nào khác. */}
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          {user?.avatarUrl ? (
            // Ảnh Google là URL ngoài và chỉ 32px, dùng <img> để khỏi phải khai báo
            // remote pattern cho next/image chỉ vì một chỗ này.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-[#10151e]">
              {user?.name.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {user?.name ?? "Chưa đăng nhập"}
            </p>
            <p className="truncate text-[11px] text-muted">
              {user ? `${ROLE_LABEL[user.role]} · ${user.email}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-btn border border-line bg-subtle px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            Về trang chủ
          </Link>
          <button
            type="button"
            onClick={signOut}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="flex items-center justify-center rounded-btn border border-line bg-subtle px-3 py-2 text-muted transition-colors hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="fixed inset-0 flex overflow-hidden bg-canvas">
        <aside className="hidden h-full shrink-0 xl:block">{sidebar}</aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[60] flex xl:hidden">
            <div
              className="absolute inset-0 bg-[#10151e]/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
              className="rounded-btn border border-line p-1.5 text-muted transition-colors hover:text-ink xl:hidden"
            >
              <Menu size={18} />
            </button>

            <AdminInput
              value={search}
              onChange={setSearch}
              ariaLabel="Tìm nhanh trong hệ thống"
              placeholder="Tìm user, giao dịch, model..."
              icon={<Search size={15} className="shrink-0 text-muted" />}
              className="max-w-sm flex-1"
            />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Đổi giao diện sáng tối"
              className="ml-auto rounded-btn border border-line p-1.5 text-muted transition-colors hover:text-ink"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
