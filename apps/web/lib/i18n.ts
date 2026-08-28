export const LOCALES = ["vi", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Chuỗi song ngữ. Mọi nội dung hiển thị đều khai báo bằng type này. */
export type Localized = Record<Locale, string>;

/** Helper rút gọn khi khai báo nội dung: L("Tiếng Việt", "English"). */
export const L = (vi: string, en: string): Localized => ({ vi, en });

export const translate = (value: Localized, locale: Locale): string =>
  value[locale];
