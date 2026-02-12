/**
 * i18n configuration - supported locales and default locale.
 *
 * @description Defines the 11 supported languages and routing config
 *              for next-intl middleware and navigation.
 */

/** All supported locale codes. */
export const LOCALES = [
  "th",
  "en",
  "lo",
  "vi",
  "zh",
  "de",
  "ja",
  "ko",
  "fr",
  "sv",
  "id",
] as const;

/** Type union of supported locales. */
export type Locale = (typeof LOCALES)[number];

/** Default locale for the application. */
export const DEFAULT_LOCALE: Locale = "th";

/** Locale display metadata (native name + flag emoji). */
export const LOCALE_META: Record<Locale, { name: string; flag: string }> = {
  th: { name: "ไทย", flag: "🇹🇭" },
  en: { name: "English", flag: "🇺🇸" },
  lo: { name: "ລາວ", flag: "🇱🇦" },
  vi: { name: "Tiếng Việt", flag: "🇻🇳" },
  zh: { name: "中文", flag: "🇨🇳" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ko: { name: "한국어", flag: "🇰🇷" },
  fr: { name: "Français", flag: "🇫🇷" },
  sv: { name: "Svenska", flag: "🇸🇪" },
  id: { name: "Indonesia", flag: "🇮🇩" },
};
