/**
 * Tailwind không hỗ trợ class động (`text-${accent}`), nên map accent -> class
 * cố định tại một nơi duy nhất để mọi component dùng chung.
 */
export type Accent = "brand" | "mint" | "amber";

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
};
