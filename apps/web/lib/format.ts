import type { Locale } from "@/lib/i18n";

const NUMBER_LOCALE: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
};

export const formatNumber = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(NUMBER_LOCALE[locale]).format(value);

/** Giá hiển thị dạng "199.000đ" (vi) / "199,000₫" (en). */
export const formatPrice = (value: number, locale: Locale): string =>
  `${formatNumber(value, locale)}${locale === "vi" ? "đ" : "₫"}`;
