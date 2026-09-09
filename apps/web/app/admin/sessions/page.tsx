"use client";

import {
  Loader2,
  LogOut,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-provider";
import {
  fetchSessions,
  revokeSession,
  signOutEverywhere,
  type SessionEntry,
} from "@/lib/auth-api";
import { DEVICE_TYPE_LABEL, describeRelativeTime } from "@/lib/device-label";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
  DataTable,
  Pill,
  TableCell,
  TableRow,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

/** Icon theo loại thiết bị — nhìn là biết phiên mở từ máy tính hay điện thoại. */
const DEVICE_ICON = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Monitor,
} as const;

/**
 * Thiết bị đang đăng nhập của **chính người quản trị đang mở trang**.
 *
 * Khác với modal thiết bị ở `/admin/users` — chỗ đó admin xem phiên của người khác.
 * Trang này là công cụ tự bảo vệ tài khoản quản trị: thấy thiết bị lạ thì đóng ngay,
 * không phải đổi mật khẩu hay nhờ ai khác.
 */
export default function AdminSessionsPage() {
  const toast = useToast();
  const { signOut } = useApp();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  /** Tải lại sau một thao tác — bảng đã hiện nên không bật lại trạng thái loading. */
  const reload = useCallback(async () => {
    try {
      setSessions(await fetchSessions());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không đọc được danh sách thiết bị",
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchSessions()
      .then((items) => {
        if (!cancelled) setSessions(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Không đọc được danh sách thiết bị",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRevoke = async (session: SessionEntry) => {
    setBusyId(session.id);
    try {
      await revokeSession(session.id);

      // Tự đóng thiết bị đang dùng thì cũng chính là đăng xuất khỏi khu quản trị.
      if (session.current) {
        signOut();
        return;
      }

      await reload();
      toast("Đã thu hồi phiên đăng nhập", "warning");
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : "Không thu hồi được phiên",
        "danger",
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeAll = async () => {
    setBusyId("all");
    try {
      await signOutEverywhere();
      signOut();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không đăng xuất được", "danger");
      setBusyId(null);
      setConfirmAll(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Thiết bị đăng nhập"
        description="Các thiết bị đang mở phiên vào tài khoản quản trị của bạn."
        actions={
          <AdminButton
            variant="danger"
            disabled={busyId !== null || sessions.length === 0}
            onClick={() => setConfirmAll(true)}
          >
            <LogOut size={14} />
            Đăng xuất mọi nơi
          </AdminButton>
        }
      />

      {error ? (
        <AdminCard>
          <p className="text-sm text-ink">{error}</p>
        </AdminCard>
      ) : null}

      <AdminCard padded={false}>
        <div className="border-b border-line p-4">
          <p className="text-xs text-muted">
            Không nhận ra một thiết bị? Thu hồi ngay — thiết bị đó mất quyền lập tức, kể cả
            khi phiên của nó chưa hết hạn.
          </p>
        </div>

        <DataTable
          headers={["Thiết bị", "Địa chỉ IP", "Đăng nhập", "Hoạt động cuối", "Thao tác"]}
          isEmpty={!loading && sessions.length === 0}
        >
          {sessions.map((session) => {
            const DeviceIcon = DEVICE_ICON[session.deviceType];
            // IP lúc mở phiên khác IP gần nhất nghĩa là phiên đã đổi mạng giữa chừng —
            // dấu hiệu đáng nhìn khi truy vết, nên hiện cả hai thay vì chỉ một.
            const movedNetwork =
              session.lastIp !== null && session.lastIp !== session.ip;

            return (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <DeviceIcon
                      size={17}
                      className={session.current ? "text-brand" : "text-muted"}
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                        {session.deviceLabel}
                        {session.current ? (
                          <Pill accent="brand">
                            <ShieldCheck size={11} className="mr-1" />
                            Thiết bị này
                          </Pill>
                        ) : null}
                        {session.isNewDevice ? (
                          <Pill accent="amber">
                            <ShieldAlert size={11} className="mr-1" />
                            Thiết bị mới
                          </Pill>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {DEVICE_TYPE_LABEL[session.deviceType]}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {session.ip ?? "Không rõ"}
                  {movedNetwork ? (
                    <span className="text-muted"> → {session.lastIp}</span>
                  ) : null}
                </TableCell>

                <TableCell className="whitespace-nowrap text-xs text-muted">
                  {describeRelativeTime(session.createdAt)}
                </TableCell>

                <TableCell className="whitespace-nowrap text-xs text-muted">
                  {describeRelativeTime(session.lastUsedAt)}
                </TableCell>

                <TableCell>
                  <AdminButton
                    disabled={busyId !== null}
                    onClick={() => void handleRevoke(session)}
                  >
                    {busyId === session.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    {session.current ? "Đăng xuất" : "Thu hồi"}
                  </AdminButton>
                </TableCell>
              </TableRow>
            );
          })}
        </DataTable>

        {loading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-brand" />
            Đang tải danh sách thiết bị...
          </p>
        ) : null}
      </AdminCard>

      <AdminModal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Đăng xuất khỏi mọi thiết bị?"
        description="Toàn bộ phiên đăng nhập của tài khoản bạn sẽ bị đóng, kể cả thiết bị đang dùng."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setConfirmAll(false)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={busyId !== null}
              onClick={() => void handleRevokeAll()}
            >
              Đăng xuất mọi nơi
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Bạn sẽ phải đăng nhập lại bằng Google. Hành động này được ghi vào nhật ký kiểm
          toán và gửi mail cảnh báo tới email của tài khoản.
        </p>
      </AdminModal>
    </>
  );
}
