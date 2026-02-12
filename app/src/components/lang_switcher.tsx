"use client";

/**
 * LangSwitcher - Language selection dropdown.
 *
 * @description Renders a dropdown with all 11 supported languages,
 *              showing flag emoji + native name. Navigates to the
 *              selected locale path on change.
 */

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";

/**
 * Language switcher dropdown component.
 *
 * @returns Select element with locale options.
 */
export default function LangSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("lang");

  /**
   * Handle locale change.
   * Replaces the current locale prefix in the URL path.
   *
   * @param e - Change event from the select element.
   */
  function handle_change(e: React.ChangeEvent<HTMLSelectElement>) {
    const new_locale = e.target.value as Locale;
    console.log(`[lang_switcher] Switching from ${locale} to ${new_locale}`);

    // Replace locale prefix in pathname
    const segments = pathname.split("/");
    segments[1] = new_locale;
    const new_path = segments.join("/") || `/${new_locale}`;

    router.push(new_path);
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="lang-select"
        className="text-xs text-text-secondary font-medium sr-only"
      >
        {t("label")}
      </label>
      <select
        id="lang-select"
        value={locale}
        onChange={handle_change}
        className="px-2.5 py-1.5 rounded-lg text-xs border border-border-primary bg-bg-secondary text-text-primary hover:border-accent cursor-pointer transition-colors appearance-none pr-7 focus:outline-none focus:ring-1 focus:ring-accent"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239aa0b4' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        {LOCALES.map((loc) => {
          const meta = LOCALE_META[loc];
          return (
            <option key={loc} value={loc}>
              {meta.flag} {meta.name}
            </option>
          );
        })}
      </select>
    </div>
  );
}
