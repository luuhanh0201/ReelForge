"use client";

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
import { AUTH_CONFIG } from "@/config/site.config";
import { translate, type Locale, type Localized } from "@/lib/i18n";
import {
  getPreferences,
  getServerPreferences,
  subscribeToPreferences,
  updatePreferences,
  type Theme,
} from "@/lib/preferences";

export type { Theme };

export type AuthProvider = "google" | "email";

export interface DemoUser {
  name: string;
  email: string;
  credits: number;
  plan: "free" | "pro";
  provider: AuthProvider;
}

/** Trạng thái bắt tay OAuth để nút hiển thị spinner. */
export type GoogleAuthStatus = "idle" | "connecting";

interface AppContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Dịch một chuỗi song ngữ theo locale hiện tại. */
  t: (value: Localized) => string;
  theme: Theme;
  toggleTheme: () => void;
  user: DemoUser | null;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  googleStatus: GoogleAuthStatus;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string) => void;
  signOut: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { theme, locale } = useSyncExternalStore(
    subscribeToPreferences,
    getPreferences,
    getServerPreferences,
  );
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus>("idle");
  const connectTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(
    () => () => {
      if (connectTimer.current !== null) window.clearTimeout(connectTimer.current);
    },
    [],
  );

  const setLocale = useCallback(
    (next: Locale) => updatePreferences({ locale: next }),
    [],
  );

  const toggleTheme = useCallback(
    () => updatePreferences({ theme: theme === "dark" ? "light" : "dark" }),
    [theme],
  );

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  /**
   * Mô phỏng OAuth 1 chạm: chờ "bắt tay" rồi nhận diện sẵn tài khoản demo,
   * cấp huy hiệu Pro và cộng credits khởi tạo. Chưa nối backend thật.
   */
  const signInWithGoogle = useCallback(() => {
    if (connectTimer.current !== null) return;

    setGoogleStatus("connecting");
    connectTimer.current = window.setTimeout(() => {
      setUser({
        ...AUTH_CONFIG.demoGoogleAccount,
        credits: AUTH_CONFIG.googleBonusCredits,
        plan: "pro",
        provider: "google",
      });
      setGoogleStatus("idle");
      setAuthOpen(false);
      connectTimer.current = null;
    }, AUTH_CONFIG.connectDelayMs);
  }, []);

  const signInWithEmail = useCallback((email: string) => {
    const [handle] = email.split("@");
    setUser({
      name: handle ? handle.slice(0, 24) : "Creator",
      email,
      credits: AUTH_CONFIG.emailSignupCredits,
      plan: "free",
      provider: "email",
    });
    setAuthOpen(false);
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      setLocale,
      t: (text: Localized) => translate(text, locale),
      theme,
      toggleTheme,
      user,
      authOpen,
      openAuth,
      closeAuth,
      googleStatus,
      signInWithGoogle,
      signInWithEmail,
      signOut,
    }),
    [
      locale,
      setLocale,
      theme,
      toggleTheme,
      user,
      authOpen,
      openAuth,
      closeAuth,
      googleStatus,
      signInWithGoogle,
      signInWithEmail,
      signOut,
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
