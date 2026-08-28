import { STORAGE_KEYS } from "@/config/site.config";
import { LOCALES, type Locale } from "@/lib/i18n";

export type Theme = "light" | "dark";

export interface Preferences {
  theme: Theme;
  locale: Locale;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  locale: "vi",
};

const listeners = new Set<() => void>();

/**
 * Snapshot phải giữ nguyên tham chiếu giữa các lần render (yêu cầu của
 * useSyncExternalStore), nên cache lại và chỉ tạo object mới khi có thay đổi.
 */
let snapshot: Preferences | null = null;

const readStorage = (): Preferences => {
  try {
    const theme = window.localStorage.getItem(STORAGE_KEYS.theme);
    const locale = window.localStorage.getItem(STORAGE_KEYS.locale);

    return {
      theme: theme === "light" || theme === "dark" ? theme : DEFAULT_PREFERENCES.theme,
      locale: LOCALES.includes(locale as Locale)
        ? (locale as Locale)
        : DEFAULT_PREFERENCES.locale,
    };
  } catch {
    // localStorage bị chặn (private mode): dùng mặc định, app vẫn chạy bình thường.
    return DEFAULT_PREFERENCES;
  }
};

const writeStorage = (preferences: Preferences) => {
  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, preferences.theme);
    window.localStorage.setItem(STORAGE_KEYS.locale, preferences.locale);
  } catch {
    /* Không lưu được thì bỏ qua, state vẫn sống trong phiên hiện tại. */
  }
};

export const getPreferences = (): Preferences => {
  snapshot ??= readStorage();
  return snapshot;
};

/** Server render luôn dùng mặc định để markup ổn định khi hydrate. */
export const getServerPreferences = (): Preferences => DEFAULT_PREFERENCES;

export const subscribeToPreferences = (onChange: () => void) => {
  listeners.add(onChange);

  // Đồng bộ khi người dùng đổi cài đặt ở tab khác.
  const handleStorage = (event: StorageEvent) => {
    if (event.key && !Object.values<string>(STORAGE_KEYS).includes(event.key)) return;
    snapshot = readStorage();
    listeners.forEach((listener) => listener());
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", handleStorage);
  };
};

export const updatePreferences = (patch: Partial<Preferences>) => {
  snapshot = { ...getPreferences(), ...patch };
  writeStorage(snapshot);
  listeners.forEach((listener) => listener());
};
