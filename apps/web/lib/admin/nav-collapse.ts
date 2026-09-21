/**
 * Nhóm menu admin nào đang thu gọn — nhớ giữa các lần mở trang.
 *
 * Dùng `useSyncExternalStore` như `lib/preferences.ts` thay vì `useState` + `useEffect`:
 * đọc `localStorage` trong lần render đầu sẽ lệch với markup do máy chủ dựng, còn đọc trong
 * effect thì eslint chặn (`setState` trong effect). Server luôn trả về "không thu gọn gì"
 * nên markup hai bên khớp nhau.
 */
const STORAGE_KEY = "reelforge.admin.nav-collapsed";

const listeners = new Set<() => void>();

/** Snapshot phải giữ nguyên tham chiếu giữa các lần render. */
let snapshot: string[] | null = null;

const EMPTY: string[] = [];

const read = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    // localStorage bị chặn hoặc dữ liệu hỏng: coi như chưa thu gọn nhóm nào.
    return [];
  }
};

export const getCollapsedGroups = (): string[] => {
  snapshot ??= read();
  return snapshot;
};

export const getServerCollapsedGroups = (): string[] => EMPTY;

export const subscribeToCollapsedGroups = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const toggleGroupCollapsed = (groupId: string) => {
  const current = getCollapsedGroups();
  snapshot = current.includes(groupId)
    ? current.filter((item) => item !== groupId)
    : [...current, groupId];

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Không lưu được thì thôi, trạng thái vẫn sống trong phiên hiện tại. */
  }

  listeners.forEach((listener) => listener());
};
