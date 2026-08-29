/**
 * Tailwind không hỗ trợ class động (`text-${accent}`), nên map accent -> class
 * cố định tại một nơi duy nhất để mọi component dùng chung.
 */
export type Accent = "brand" | "mint" | "amber" | "danger" | "info" | "voice";

export const ACCENT: Record<
  Accent,
  {
    hex: string;
    text: string;
    bg: string;
    softBg: string;
    border: string;
    shadow: string;
  }
> = {
  brand: {
    hex: "#ff6b35",
    text: "text-brand",
    bg: "bg-brand",
    softBg: "bg-brand/10",
    border: "border-brand/35",
    shadow: "shadow-[0_0_40px_-12px_#ff6b35]",
  },
  mint: {
    hex: "#35c48f",
    text: "text-mint",
    bg: "bg-mint",
    softBg: "bg-mint/10",
    border: "border-mint/35",
    shadow: "shadow-[0_0_40px_-12px_#35c48f]",
  },
  amber: {
    hex: "#f2b237",
    text: "text-amber",
    bg: "bg-amber",
    softBg: "bg-amber/10",
    border: "border-amber/35",
    shadow: "shadow-[0_0_40px_-12px_#f2b237]",
  },
  danger: {
    hex: "#f2545b",
    text: "text-danger",
    bg: "bg-danger",
    softBg: "bg-danger/10",
    border: "border-danger/35",
    shadow: "shadow-[0_0_40px_-12px_#f2545b]",
  },
  info: {
    hex: "#3b82f6",
    text: "text-info",
    bg: "bg-info",
    softBg: "bg-info/10",
    border: "border-info/35",
    shadow: "shadow-[0_0_40px_-12px_#3b82f6]",
  },
  voice: {
    hex: "#a855f7",
    text: "text-voice",
    bg: "bg-voice",
    softBg: "bg-voice/10",
    border: "border-voice/35",
    shadow: "shadow-[0_0_40px_-12px_#a855f7]",
  },
};
