"use client";

/**
 * ThemeToggle - Light/dark mode toggle button.
 *
 * @description Renders a sun/moon icon button that toggles
 *              between light and dark themes via ThemeContext.
 */

import { useTheme } from "@/lib/theme";
import { useTranslations } from "next-intl";

/**
 * Toggle button for light/dark mode.
 *
 * @returns Button element with sun (light) or moon (dark) icon.
 */
export default function ThemeToggle() {
  const { theme, toggle_theme } = useTheme();
  const t = useTranslations("theme");

  console.log(`[theme_toggle] Rendering, current theme: ${theme}`);

  return (
    <button
      onClick={toggle_theme}
      className="w-9 h-9 rounded-lg border border-border-primary bg-bg-secondary text-text-primary flex items-center justify-center text-lg hover:bg-accent hover:border-accent hover:text-white transition-colors cursor-pointer"
      title={t("toggle")}
      aria-label={t("toggle")}
    >
      {theme === "dark" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
