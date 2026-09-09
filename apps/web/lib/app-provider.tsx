"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthMode } from "@/config/content.config";
import {
  fetchCurrentUser,
  loginWithPassword,
  registerWithPassword,
  resolveRedirect,
  signInWithGoogleCode,
  signOut as signOutRequest,
  type AuthUser,
  type RegisterPayload,
} from "@/lib/auth-api";
import { requestGoogleAuthCode } from "@/lib/google-identity";
import { translate, type Locale, type Localized } from "@/lib/i18n";
import {
  getPreferences,
  getServerPreferences,
  subscribeToPreferences,
  updatePreferences,
  type Theme,
} from "@/lib/preferences";

export type { Theme };
export type { AuthUser };

/** Trạng thái bắt tay OAuth để nút hiển thị spinner. */
export type GoogleAuthStatus = "idle" | "connecting";

/** Giữ khớp với `matcher` của `middleware.ts`. */
const PRIVATE_PREFIXES = ["/admin", "/studio"];

interface AppContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Dịch một chuỗi song ngữ theo locale hiện tại. */
  t: (value: Localized) => string;
  theme: Theme;
  toggleTheme: () => void;
  user: AuthUser | null;
  /** Chưa biết đã đăng nhập hay chưa — lần hỏi `/auth/me` đầu tiên đang chạy. */
  authLoading: boolean;
  authOpen: boolean;
  /** Modal mở ở chế độ đăng nhập hay đăng ký. */
  authMode: AuthMode;
  /**
   * `redirectTo` là nơi người dùng đang muốn tới khi bị chặn ở cửa. Bỏ trống thì sau khi
   * đăng nhập họ được đưa về khu vực ứng với vai của mình.
   */
  openAuth: (mode?: AuthMode, redirectTo?: string | null) => void;
  setAuthMode: (mode: AuthMode) => void;
  closeAuth: () => void;
  googleStatus: GoogleAuthStatus;
  /** Lỗi của lần đăng nhập gần nhất, hiện ngay trong AuthModal. */
  authError: string | null;
  signInWithGoogle: () => void;
  /** Đăng nhập bằng email và mật khẩu. Ném lỗi để form tự hiện thông báo. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Đăng ký. Không đăng nhập ngay — tài khoản phải xác minh email trước. */
  register: (payload: RegisterPayload) => Promise<void>;
  signOut: () => void;
  /** Cập nhật lại hồ sơ sau khi người dùng tự đổi thứ gì đó (thu hồi phiên chẳng hạn). */
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { theme, locale } = useSyncExternalStore(
    subscribeToPreferences,
    getPreferences,
    getServerPreferences,
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus>("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  /** Đường dẫn người dùng bị chặn khi vào, giữ lại để trả họ về đúng chỗ sau đăng nhập. */
  const redirectAfterSignIn = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /**
   * Khôi phục phiên khi mở trang. Cookie là HttpOnly nên JS không đọc được trạng thái
   * đăng nhập — cách duy nhất để biết là hỏi API.
   */
  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // Chưa đăng nhập là trạng thái bình thường, không phải lỗi để hiện lên UI.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(
    (next: Locale) => updatePreferences({ locale: next }),
    [],
  );

  const toggleTheme = useCallback(
    () => updatePreferences({ theme: theme === "dark" ? "light" : "dark" }),
    [theme],
  );

  const openAuth = useCallback(
    (mode: AuthMode = "signin", redirectTo: string | null = null) => {
      redirectAfterSignIn.current = redirectTo;
      setAuthMode(mode);
      setAuthError(null);
      setAuthOpen(true);
    },
    [],
  );
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  /**
   * Đưa người vừa đăng nhập tới đúng nơi của họ. Tách riêng vì cả Google lẫn
   * email/mật khẩu đều dùng chung một luật điều hướng.
   */
  const completeSignIn = useCallback(
    (current: AuthUser) => {
      setUser(current);
      setAuthOpen(false);

      const target = resolveRedirect(current, redirectAfterSignIn.current);
      redirectAfterSignIn.current = null;

      if (target !== pathname) router.push(target);
    },
    [router, pathname],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      completeSignIn(await loginWithPassword(email, password));
    },
    [completeSignIn],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    setAuthError(null);
    await registerWithPassword(payload);
  }, []);

  /**
   * Đăng nhập Google thật: mở popup lấy authorization code rồi để backend đổi code.
   * Trình duyệt nhận cookie phiên, ở đây chỉ giữ hồ sơ hiển thị.
   */
  const signInWithGoogle = useCallback(() => {
    if (googleStatus === "connecting") return;

    setGoogleStatus("connecting");
    setAuthError(null);

    requestGoogleAuthCode()
      .then(signInWithGoogleCode)
      // Admin và nhân sự nội bộ vào thẳng khu quản trị, khách vào Studio — trừ khi họ
      // đang muốn tới một trang cụ thể thì trả họ về đúng trang đó.
      .then(completeSignIn)
      .catch((error: unknown) => {
        setAuthError(
          error instanceof Error ? error.message : "Đăng nhập Google thất bại",
        );
      })
      .finally(() => setGoogleStatus("idle"));
  }, [googleStatus, completeSignIn]);

  const signOut = useCallback(() => {
    // Xoá trạng thái ngay để giao diện phản hồi tức thì; cookie do backend dọn.
    setUser(null);
    void signOutRequest().catch(() => undefined);

    // Đang đứng trong khu vực cần đăng nhập thì phải rời đi, nếu không người vừa đăng
    // xuất sẽ ngồi nhìn màn hình 403 của chính trang họ vừa dùng.
    if (PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      router.push("/");
    }
  }, [router, pathname]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      setLocale,
      t: (text: Localized) => translate(text, locale),
      theme,
      toggleTheme,
      user,
      authLoading,
      authOpen,
      authMode,
      openAuth,
      setAuthMode,
      closeAuth,
      googleStatus,
      authError,
      signInWithGoogle,
      signInWithPassword,
      register,
      signOut,
      refreshUser,
    }),
    [
      locale,
      setLocale,
      theme,
      toggleTheme,
      user,
      authLoading,
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      googleStatus,
      authError,
      signInWithGoogle,
      signInWithPassword,
      register,
      signOut,
      refreshUser,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp phải được dùng bên trong <AppProvider>");
  }
  return context;
}
