"use client";

/**
 * StatsBar - Summary statistics chips displayed on the map overlay.
 *
 * @description Shows province count, total constituencies, registered
 *              voters, and vote station counts. i18n and theme-aware.
 */

import { useTranslations } from "next-intl";
import type { TotalStats } from "@/types/constituency";

interface StatsBarProps {
  /** Summary totals across all provinces. */
  totals: TotalStats;
}

/**
 * Format a number with commas for display.
 *
 * @param n - Number to format.
 * @returns Formatted string with thousands separators.
 */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Stat item configuration mapping data keys to i18n keys. */
const STAT_ITEMS: { key: keyof TotalStats; i18n_key: string }[] = [
  { key: "provinces", i18n_key: "provinces" },
  { key: "constituencies", i18n_key: "constituencies" },
  { key: "registered_voters", i18n_key: "voters" },
  { key: "vote_stations", i18n_key: "stations" },
];

/**
 * Statistics overlay with translated labels.
 *
 * @param totals - Aggregated stats to display.
 * @returns Row of stat chips positioned at top-right below topbar.
 */
export default function StatsBar({ totals }: StatsBarProps) {
  const t = useTranslations("stats");

  console.log("[stats_bar] Rendering stats bar");

  return (
    <div className="absolute top-20 right-6 flex gap-2.5 z-50">
      {STAT_ITEMS.map((item) => (
        <div
          key={item.key}
          className="bg-bg-tertiary border border-border-primary rounded-lg px-3 py-1.5 text-center"
        >
          <div className="text-base font-bold text-accent-light">
            {fmt(totals[item.key])}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">
            {t(item.i18n_key)}
          </div>
        </div>
      ))}
    </div>
  );
}
