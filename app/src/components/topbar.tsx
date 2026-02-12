"use client";

/**
 * TopBar - Responsive floating toolbar overlaying the map.
 *
 * @description Desktop: centered pill bar with all nav links inline.
 *              Mobile: compact bar with brand + burger menu that opens
 *              a slide-down nav panel. Shared across all pages.
 */

import { useTranslations } from "next-intl";
import { useTheme } from "@/lib/theme";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { useState, useRef, useEffect, useCallback } from "react";

interface TopBarProps {
  /** Custom center controls to render instead of default nav links. */
  center_controls?: React.ReactNode;
  /** Horizontal alignment: 'center' (default) or 'left'. */
  align?: "center" | "left";
}

/** Nav link definition for building menu items. */
interface NavLink {
  /** Route segment (e.g. "diff-count"). */
  route: string;
  /** i18n key for the label (e.g. "heatmap"). */
  label_key: string;
  /** SVG icon content (children of <svg>). */
  icon: React.ReactNode;
}

/**
 * Floating pill topbar with branding, page nav links, and settings.
 * Responsive: desktop shows inline links, mobile shows hamburger menu.
 *
 * @param center_controls - Custom ReactNode to replace default center section.
 * @param align - Horizontal alignment: 'center' (default) or 'left'.
 * @returns Floating centered toolbar overlay.
 */
export default function TopBar({
  center_controls,
  align = "center",
}: TopBarProps) {
  const t_topbar = useTranslations("topbar");
  const t_theme = useTranslations("theme");
  const { theme, toggle_theme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [lang_open, set_lang_open] = useState(false);
  const [menu_open, set_menu_open] = useState(false);
  const lang_ref = useRef<HTMLDivElement>(null);
  const menu_ref = useRef<HTMLDivElement>(null);

  console.log("[topbar] Rendering topbar");

  /**
   * Close language dropdown on outside click.
   */
  useEffect(() => {
    function handle_click_outside(e: MouseEvent) {
      if (lang_ref.current && !lang_ref.current.contains(e.target as Node)) {
        set_lang_open(false);
      }
      if (menu_ref.current && !menu_ref.current.contains(e.target as Node)) {
        set_menu_open(false);
      }
    }
    document.addEventListener("mousedown", handle_click_outside);
    return () => document.removeEventListener("mousedown", handle_click_outside);
  }, []);

  /**
   * Handle locale switch from the dropdown.
   *
   * @param new_locale - Target locale code.
   */
  const handle_locale_change = useCallback(
    (new_locale: Locale) => {
      console.log(`[topbar] Switching locale from ${locale} to ${new_locale}`);
      const segments = pathname.split("/");
      segments[1] = new_locale;
      const new_path = segments.join("/") || `/${new_locale}`;
      router.push(new_path);
      set_lang_open(false);
      set_menu_open(false);
    },
    [locale, pathname, router]
  );

  const current_meta = LOCALE_META[locale as Locale];

  /**
   * Check if a nav link path matches the current pathname.
   *
   * @param link_path - The route segment to check (e.g. "/diff-count").
   * @returns True if the current pathname ends with the given segment.
   */
  const is_active_link = (link_path: string): boolean => {
    return pathname.endsWith(link_path);
  };

  /** Whether the current page is the home/root page (no sub-route). */
  const is_home = pathname === `/${locale}` || pathname === `/${locale}/`;

  /**
   * Build nav link className with active state (desktop inline links).
   *
   * @param route_segment - The route segment (e.g. "diff-count").
   * @returns Tailwind class string with active or default styling.
   */
  const nav_link_class = (route_segment: string): string => {
    const active = is_active_link(`/${route_segment}`);
    return `flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? "bg-accent/15 text-accent"
        : "text-text-secondary hover:bg-accent/10 hover:text-accent"
    }`;
  };

  /**
   * Build mobile nav link className with active state.
   *
   * @param route_segment - The route segment (e.g. "diff-count").
   * @returns Tailwind class string for mobile menu items.
   */
  const mobile_nav_class = (route_segment: string): string => {
    const active = is_active_link(`/${route_segment}`);
    return `flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors rounded-xl ${
      active
        ? "bg-accent/15 text-accent"
        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
    }`;
  };

  /** Navigation links shared between desktop and mobile. */
  const nav_links: NavLink[] = [
    {
      route: "diff-count",
      label_key: "heatmap",
      icon: (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      ),
    },
    {
      route: "diffwinratio",
      label_key: "diffwinratio",
      icon: (
        <>
          <circle cx="7.5" cy="7.5" r="2" />
          <circle cx="16" cy="16" r="3" />
          <circle cx="18" cy="6" r="1.5" />
          <circle cx="5" cy="17" r="1.5" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ),
    },
    {
      route: "heatmap",
      label_key: "graphs",
      icon: (
        <>
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="6" width="4" height="15" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </>
      ),
    },
    {
      route: "party-analysis",
      label_key: "party_analysis",
      icon: (
        <>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </>
      ),
    },
  ];

  /** Common SVG props for nav icons. */
  const icon_svg_props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0",
  };

  return (
    <>
      {/* ── Main TopBar ── */}
      <div
        className={`absolute top-4 z-[90] w-[calc(100%-2rem)] sm:w-auto ${
          align === "left" ? "left-4" : "left-4 sm:left-1/2 sm:-translate-x-1/2"
        }`}
      >
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          {/* Brand button — always links back to root map */}
          <a
            href={`/${locale}`}
            className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 transition-colors cursor-pointer group no-underline shrink-0 ${
              is_home
                ? "bg-accent/15"
                : "bg-bg-tertiary hover:bg-accent/10"
            }`}
            title={t_topbar("brand")}
            onClick={() => set_menu_open(false)}
          >
            {/* Ballot box icon */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-accent shrink-0"
            >
              <path
                d="M9 12l2 2 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M5 7a2 2 0 012-2h10a2 2 0 012 2v2H5V7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 9h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={`text-sm font-semibold transition-colors whitespace-nowrap hidden sm:inline ${
                is_home ? "text-accent" : "text-text-primary group-hover:text-accent"
              }`}
            >
              {t_topbar("brand")}
            </span>
          </a>

          {/* Desktop nav links (hidden on mobile) */}
          {!center_controls ? (
            <div className="hidden md:flex items-center">
              {nav_links.map((link) => (
                <a
                  key={link.route}
                  href={`/${locale}/${link.route}`}
                  className={nav_link_class(link.route)}
                  title={t_topbar(link.label_key)}
                >
                  <svg {...icon_svg_props}>{link.icon}</svg>
                  {t_topbar(link.label_key)}
                </a>
              ))}
            </div>
          ) : (
            <div className="hidden md:flex items-center">{center_controls}</div>
          )}

          {/* Spacer pushes right-side controls to the end on mobile */}
          <div className="flex-1 md:hidden" />

          {/* Separator (desktop only) */}
          <div className="hidden md:block w-px h-6 bg-border-primary mx-0.5" />

          {/* Theme toggle */}
          <button
            onClick={toggle_theme}
            className="flex items-center rounded-full p-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer shrink-0"
            title={t_theme("toggle")}
            aria-label={t_theme("toggle")}
          >
            {theme === "dark" ? (
              <svg {...icon_svg_props}>
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
              <svg {...icon_svg_props}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Language switcher (globe icon + dropdown) */}
          <div ref={lang_ref} className="relative shrink-0">
            <button
              onClick={() => set_lang_open(!lang_open)}
              className="flex items-center rounded-full p-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer"
              title={current_meta?.name}
            >
              <svg {...icon_svg_props}>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </button>

            {/* Language dropdown */}
            {lang_open && (
              <div className="absolute top-full right-0 mt-2 bg-bg-secondary border border-border-primary rounded-xl shadow-[0_8px_32px_var(--shadow-tooltip)] py-1 min-w-[160px] max-h-[280px] overflow-y-auto z-[100]">
                {LOCALES.map((loc) => {
                  const meta = LOCALE_META[loc];
                  return (
                    <button
                      key={loc}
                      onClick={() => handle_locale_change(loc)}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-bg-tertiary transition-colors cursor-pointer ${
                        loc === locale
                          ? "text-accent font-semibold"
                          : "text-text-secondary"
                      }`}
                    >
                      <span className="w-5 text-center text-[10px] font-bold uppercase opacity-60">
                        {loc}
                      </span>
                      <span>{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hamburger button (mobile only) */}
          <div ref={menu_ref} className="relative md:hidden shrink-0">
            <button
              onClick={() => set_menu_open(!menu_open)}
              className="flex items-center rounded-full p-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Menu"
            >
              {menu_open ? (
                /* X close icon */
                <svg {...icon_svg_props}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg {...icon_svg_props}>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile slide-down menu ── */}
      {menu_open && (
        <div className="fixed inset-0 z-[89] md:hidden" onClick={() => set_menu_open(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Menu panel */}
          <div
            className="absolute top-16 left-4 right-4 bg-bg-secondary/98 backdrop-blur-xl border border-border-primary rounded-2xl shadow-[0_8px_40px_var(--shadow-tooltip)] p-3 animate-[slideDown_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nav links */}
            <nav className="space-y-1 mb-3">
              {/* Home link */}
              <a
                href={`/${locale}`}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors rounded-xl ${
                  is_home
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
                onClick={() => set_menu_open(false)}
              >
                <svg {...icon_svg_props}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {t_topbar("brand")}
              </a>

              {/* Page nav links */}
              {nav_links.map((link) => (
                <a
                  key={link.route}
                  href={`/${locale}/${link.route}`}
                  className={mobile_nav_class(link.route)}
                  onClick={() => set_menu_open(false)}
                >
                  <svg {...icon_svg_props}>{link.icon}</svg>
                  {t_topbar(link.label_key)}
                </a>
              ))}
            </nav>

            {/* Divider */}
            <div className="h-px bg-border-primary mx-2 mb-3" />

            {/* Settings row: theme + current locale */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <svg {...icon_svg_props}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span className="font-medium uppercase">{locale}</span>
                <span className="text-text-secondary">{current_meta?.name}</span>
              </div>
              <button
                onClick={toggle_theme}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                {theme === "dark" ? (
                  <svg {...icon_svg_props}>
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
                  <svg {...icon_svg_props}>
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {t_theme("toggle")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
