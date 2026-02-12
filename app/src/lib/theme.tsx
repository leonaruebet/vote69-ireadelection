"use client";

/**
 * Theme context provider for light/dark mode.
 *
 * @description Manages theme state with localStorage persistence.
 *              Applies 'dark' or 'light' class to <html> element.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/** Supported theme values. */
export type Theme = "light" | "dark";

/** Theme context shape. */
interface ThemeContextValue {
  /** Current active theme. */
  theme: Theme;
  /** Toggle between light and dark. */
  toggle_theme: () => void;
}

const STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle_theme: () => {},
});

/**
 * Apply theme class to document element.
 *
 * @param theme - Theme to apply ('light' or 'dark').
 */
function apply_theme(theme: Theme): void {
  console.log(`[theme] Applying theme: ${theme}`);
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

/**
 * ThemeProvider - Wraps children with theme context.
 *
 * @description Uses SSR-safe default ("dark") during server render and initial
 *              hydration. Reads actual theme from localStorage in useEffect to
 *              avoid hydration mismatch. The layout's inline script already sets
 *              the correct CSS class before React hydrates, so there is no FOUC.
 * @param children - React children to wrap.
 * @returns Provider component with theme state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set_theme] = useState<Theme>("dark");

  /**
   * Read stored theme after mount to avoid hydration mismatch.
   * Server always renders with "dark" default; client syncs from localStorage
   * in this effect so the React tree matches during hydration.
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        console.log(`[theme] Hydration sync: localStorage has "${stored}"`);
        set_theme(stored);
      }
    } catch {
      /* restricted storage */
    }
  }, []);

  /** Apply theme class whenever theme changes (after mount). */
  useEffect(() => {
    apply_theme(theme);
  }, [theme]);

  /**
   * Toggle between light and dark themes.
   * Persists selection to localStorage.
   */
  const toggle_theme = useCallback(() => {
    set_theme((prev) => {
      const next_theme = prev === "dark" ? "light" : "dark";
      console.log(`[theme] Toggling from ${prev} to ${next_theme}`);
      try {
        localStorage.setItem(STORAGE_KEY, next_theme);
      } catch {
        /* restricted storage */
      }
      return next_theme;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle_theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access current theme and toggle function.
 *
 * @returns ThemeContextValue with theme and toggle_theme.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
