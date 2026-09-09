"use client";

import {
  Coins,
  Download,
  Loader2,
  Lock,
  LogOut,
  MonitorSmartphone,
  Pencil,
  Search,
  ShieldAlert,
  Unlock,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ROLE_LABEL } from "@/config/admin/accounts.config";
import {
  PLAN_ACCENT,
  PLAN_LABEL,
  PLAN_ORDER,
  type UserPlan,
} from "@/config/plans.config";
import { usePagination } from "@/lib/admin/pagination";
import {
  fetchAdminUsers,
  fetchUserSessions,
  revokeUserSessions,
  updateAdminUser,
  type AdminUserEntry,
} from "@/lib/admin/users-api";
import type { SessionEntry, UserRole } from "@/lib/auth-api";
import { DEVICE_TYPE_LABEL, describeRelativeTime } from "@/lib/device-label";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Pill,
  StatusBadge,
  TableCell,
  TablePagination,
  TableRow,
} from "@/components/admin/primitives";
import { AdminModal } from "@/components/admin/admin-modal";
import { useToast } from "@/components/admin/toast";

type PlanFilter = UserPlan | "all";
type StatusFilter = "all" | "active" | "suspended";

/** Dựng từ `PLAN_ORDER` để thêm gói mới là bộ lọc tự có, không phải sửa hai chỗ. */
const PLAN_OPTIONS: { id: PlanFilter; label: string }[] = [
  { id: "all", label: "Tất cả gói" },
  ...PLAN_ORDER.map((plan) => ({ id: plan, label: PLAN_LABEL[plan].vi })),
];

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Mọi trạng thái" },
  { id: "active", label: "Hoạt động" },
  { id: "suspended", label: "Bị khóa" },
];

const ROLE_OPTIONS: { id: UserRole; label: string }[] = [
  { id: "user", label: "Người dùng" },
  { id: "viewer", label: "Viewer" },
  { id: "editor", label: "Editor" },
  { id: "admin", label: "Admin" },
];

const downloadFile = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("vi-VN") : "—";

/**
 * Quản trị người dùng — đọc ghi dữ liệu thật từ `/admin/users`.
 *
 * Tài khoản chỉ sinh ra qua đăng nhập Google nên **không có nút tạo tay**; đổi lại
 * trang này quản lý được thứ trước đây không nhìn thấy: các thiết bị đang đăng nhập.
 */
export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [saving, setSaving] = useState(false);

  const [creditTarget, setCreditTarget] = useState<AdminUserEntry | null>(null);
  const [creditAmount, setCreditAmount] = useState("10");
  const [editTarget, setEditTarget] = useState<AdminUserEntry | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [lockTarget, setLockTarget] = useState<AdminUserEntry | null>(null);
  const [sessionTarget, setSessionTarget] = useState<AdminUserEntry | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchAdminUsers()
      .then((items) => {
        if (!cancelled) setUsers(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error ? cause.message : "Không đọc được danh sách người dùng",
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

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const keyword = query.trim().toLowerCase();
        const matchQuery =
          keyword === "" ||
          user.name.toLowerCase().includes(keyword) ||
          user.email.toLowerCase().includes(keyword) ||
          user.id.toLowerCase().includes(keyword);

        return (
          matchQuery &&
          (plan === "all" || user.plan === plan) &&
          (status === "all" || user.status === status)
        );
      }),
    [users, query, plan, status],
  );

  const pagination = usePagination(filtered);

  /** Ghi thay đổi lên API rồi thay đúng một dòng trong bảng bằng bản server trả về. */
  const applyUpdate = async (
    user: AdminUserEntry,
    payload: Parameters<typeof updateAdminUser>[1],
    successMessage: string,
    tone: "success" | "warning" = "success",
  ) => {
    setSaving(true);
    try {
      const updated = await updateAdminUser(user.id, payload);
      setUsers((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast(successMessage, tone);
      return true;
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không lưu được thay đổi", "danger");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyCredits = async (delta: number) => {
    if (!creditTarget) return;

    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Số credits phải là số dương", "warning");
      return;
    }

    const next = Math.max(0, creditTarget.credits + delta * amount);
    const done = await applyUpdate(
      creditTarget,
      { credits: next },
      `${delta > 0 ? "Đã cộng" : "Đã trừ"} ${amount} credits cho ${creditTarget.name}`,
      delta > 0 ? "success" : "warning",
    );

    if (done) setCreditTarget(null);
  };

  const saveRole = async () => {
    if (!editTarget) return;

    const done = await applyUpdate(
      editTarget,
      { role: editRole },
      `${editTarget.name} giờ có quyền ${ROLE_LABEL[editRole]}`,
    );

    if (done) setEditTarget(null);
  };

  const toggleLock = async () => {
    if (!lockTarget) return;

    const nextStatus = lockTarget.status === "active" ? "suspended" : "active";
    const done = await applyUpdate(
      lockTarget,
      { status: nextStatus },
      nextStatus === "suspended"
        ? `Đã khóa tài khoản ${lockTarget.name} và thu hồi mọi phiên đăng nhập`
        : `Đã mở khóa tài khoản ${lockTarget.name}`,
      nextStatus === "suspended" ? "warning" : "success",
    );

    if (done) setLockTarget(null);
  };

  const openSessions = async (user: AdminUserEntry) => {
    setSessionTarget(user);
    setSessions([]);
    setSessionsLoading(true);

    try {
      setSessions(await fetchUserSessions(user.id));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không đọc được phiên", "danger");
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSessions = async () => {
    if (!sessionTarget) return;

    setSaving(true);
    try {
      const { revoked } = await revokeUserSessions(sessionTarget.id);
      setUsers((current) =>
        current.map((row) =>
          row.id === sessionTarget.id ? { ...row, activeSessions: 0 } : row,
        ),
      );
      toast(`Đã thu hồi ${revoked} phiên của ${sessionTarget.name}`, "warning");
      setSessionTarget(null);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Không thu hồi được phiên", "danger");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = "ID,Họ tên,Email,Gói,Quyền,Trạng thái,Credits,Thiết bị,Đăng nhập gần nhất";
    const rows = filtered.map((user) =>
      [
        user.id,
        user.name,
        user.email,
        PLAN_LABEL[user.plan].vi,
        ROLE_LABEL[user.role],
        user.status === "active" ? "Hoạt động" : "Bị khóa",
        user.credits,
        user.activeSessions,
        formatDate(user.lastLoginAt),
      ].join(","),
    );

    downloadFile("reelforge-users.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    toast(`Đã xuất ${filtered.length} dòng ra CSV`);
  };

  return (
    <>
      <AdminPageHeader
        title="Quản trị người dùng"
        description="Tài khoản đăng nhập bằng Google, kèm thiết bị đang mở phiên."
        actions={
          <AdminButton onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={14} />
            Xuất danh sách
          </AdminButton>
        }
      />

      {loadError ? (
        <AdminCard>
          <p className="text-sm text-ink">{loadError}</p>
        </AdminCard>
      ) : null}

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <AdminInput
            ariaLabel="Tìm theo tên, email hoặc ID"
            value={query}
            onChange={setQuery}
            placeholder="Tìm tên, email, ID tài khoản..."
            icon={<Search size={15} className="shrink-0 text-muted" />}
            className="w-full sm:w-72"
          />
          <AdminSelect ariaLabel="Lọc theo gói" value={plan} onChange={setPlan} options={PLAN_OPTIONS} />
          <AdminSelect
            ariaLabel="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
          <p className="ml-auto text-xs text-muted">
            {loading ? "Đang tải..." : `${filtered.length}/${users.length} tài khoản`}
          </p>
        </div>

        <DataTable
          headers={["Người dùng", "Gói & quyền", "Credits", "Thiết bị", "Đăng nhập", "Thao tác"]}
          isEmpty={!loading && filtered.length === 0}
        >
          {pagination.items.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-[#10151e]">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill accent={PLAN_ACCENT[user.plan]}>
                    {PLAN_LABEL[user.plan].vi}
                  </Pill>
                  <span className="text-xs text-muted">{ROLE_LABEL[user.role]}</span>
                </div>
                <StatusBadge
                  className="mt-1.5"
                  status={user.status === "active" ? "up" : "down"}
                  label={user.status === "active" ? "Hoạt động" : "Bị khóa"}
                />
              </TableCell>

              <TableCell className="font-mono text-sm font-bold text-ink">
                {user.credits}
              </TableCell>

              <TableCell>
                <button
                  type="button"
                  onClick={() => void openSessions(user)}
                  className="inline-flex items-center gap-1.5 rounded-btn px-1.5 py-1 font-mono text-sm text-ink transition-colors hover:bg-subtle"
                  title="Xem thiết bị đang đăng nhập"
                >
                  <MonitorSmartphone
                    size={15}
                    className={user.activeSessions > 0 ? "text-mint" : "text-muted"}
                  />
                  {user.activeSessions}
                </button>
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                {formatDate(user.lastLoginAt)}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1">
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    title="Điều chỉnh credits"
                    onClick={() => {
                      setCreditTarget(user);
                      setCreditAmount("10");
                    }}
                  >
                    <Coins size={15} />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    title="Đổi vai trò"
                    onClick={() => {
                      setEditTarget(user);
                      setEditRole(user.role);
                    }}
                  >
                    <Pencil size={15} />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    className="w-9 px-0"
                    title="Khóa hoặc mở khóa tài khoản"
                    onClick={() => setLockTarget(user)}
                  >
                    {user.status === "active" ? <Lock size={15} /> : <Unlock size={15} />}
                  </AdminButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>

        <TablePagination pagination={pagination} unit="người dùng" />
      </AdminCard>

      <AdminModal
        open={creditTarget !== null}
        onClose={() => setCreditTarget(null)}
        title={`Điều chỉnh credits · ${creditTarget?.name ?? ""}`}
        description={`Số dư hiện tại: ${creditTarget?.credits ?? 0} credits.`}
        footer={
          <>
            <AdminButton variant="danger" disabled={saving} onClick={() => void applyCredits(-1)}>
              Trừ bớt
            </AdminButton>
            <AdminButton variant="primary" disabled={saving} onClick={() => void applyCredits(1)}>
              Nạp thêm
            </AdminButton>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Số credits</span>
          <AdminInput ariaLabel="Số credits" value={creditAmount} onChange={setCreditAmount} />
        </label>
      </AdminModal>

      <AdminModal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Phân quyền · ${editTarget?.name ?? ""}`}
        description="Quyền áp dụng ngay ở request kế tiếp của người dùng đó."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setEditTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton variant="primary" disabled={saving} onClick={() => void saveRole()}>
              Lưu
            </AdminButton>
          </>
        }
      >
        <AdminSelect
          ariaLabel="Chọn quyền"
          value={editRole}
          onChange={setEditRole}
          options={ROLE_OPTIONS}
          className="w-full"
        />
      </AdminModal>

      <AdminModal
        open={lockTarget !== null}
        onClose={() => setLockTarget(null)}
        title={lockTarget?.status === "active" ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}
        description={
          lockTarget?.status === "active"
            ? `${lockTarget?.name} sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được.`
            : `${lockTarget?.name} sẽ đăng nhập và dùng credits trở lại bình thường.`
        }
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setLockTarget(null)}>
              Huỷ
            </AdminButton>
            <AdminButton
              variant={lockTarget?.status === "active" ? "danger" : "primary"}
              disabled={saving}
              onClick={() => void toggleLock()}
            >
              Xác nhận
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-muted">
          Hành động này được ghi vào nhật ký kiểm toán ở mức{" "}
          <span className="font-bold text-danger">WARNING</span>.
        </p>
      </AdminModal>

      <AdminModal
        open={sessionTarget !== null}
        onClose={() => setSessionTarget(null)}
        title={`Thiết bị đăng nhập · ${sessionTarget?.name ?? ""}`}
        description="Thu hồi sẽ đăng xuất tài khoản này khỏi mọi thiết bị ngay lập tức."
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => setSessionTarget(null)}>
              Đóng
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={saving || sessions.length === 0}
              onClick={() => void revokeSessions()}
            >
              <LogOut size={14} />
              Thu hồi tất cả
            </AdminButton>
          </>
        }
      >
        {sessionsLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin text-brand" />
            Đang tải danh sách thiết bị...
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted">Tài khoản này không có phiên nào đang mở.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={`rounded-btn border px-3 py-2 ${
                  session.isNewDevice
                    ? "border-amber/40 bg-amber/[0.06]"
                    : "border-line bg-canvas"
                }`}
              >
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {session.deviceLabel}
                  <span className="text-xs font-medium text-muted">
                    {DEVICE_TYPE_LABEL[session.deviceType]}
                  </span>
                  {session.isNewDevice ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold text-amber">
                      <ShieldAlert size={11} />
                      Thiết bị mới
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  {session.ip ?? "Không rõ IP"}
                  {session.lastIp !== null && session.lastIp !== session.ip
                    ? ` → ${session.lastIp}`
                    : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Đăng nhập {describeRelativeTime(session.createdAt)} · hoạt động{" "}
                  {describeRelativeTime(session.lastUsedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminModal>
    </>
  );
}
