"use client";

/**
 * MapClient - Root page showing regional diff statistics.
 *
 * @description Full-page layout with TopBar and regional diff stats
 *              (nationwide + 6 Thai regions) displayed as inline content.
 *              Toggle between absolute count diff and percentage diff modes.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  TotalStats,
  ElectionLookups,
} from "@/types/constituency";
import {
  get_diff_dot_colors,
  REGION_ORDER,
  REGION_NAMES,
  type RegionKey,
} from "@/lib/constants";
import TopBar from "@/components/topbar";
import {
  compute_region_stats,
  group_by_region,
  type RegionDiffStats,
} from "@/components/diff_stats_panel";
import WinnerDiffPiechart, { type WinnerDiffItem } from "@/components/winner_diff_piechart";

/** Diff display mode: absolute count or percentage. */
type DiffDisplayMode = "absolute" | "percent";

interface MapClientProps {
  /** Enriched constituency GeoJSON features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Summary totals across all provinces. */
  totals: TotalStats;
  /** Election result lookups (winners, party list, referendum). */
  election_lookups: ElectionLookups;
}

/**
 * Compute the overall % diff: Σ|diff_count| / avg(Σmp, Σpl) × 100.
 *
 * @param stats - Aggregated region stats with turnout totals.
 * @returns Overall percentage diff relative to average turnout.
 */
function compute_overall_pct(stats: RegionDiffStats): number {
  const avg_turnout = (stats.total_mp_turnout + stats.total_pl_turnout) / 2;
  if (avg_turnout === 0) return 0;
  return (stats.sum_abs_count / avg_turnout) * 100;
}

/**
 * Root page with regional diff statistics displayed inline.
 * Supports toggle between absolute count and percentage diff modes.
 *
 * @param features - Enriched constituency GeoJSON features.
 * @param totals - Summary totals across all provinces.
 * @param election_lookups - Election lookups including diff data.
 * @returns Full-page stats layout.
 */
export default function MapClient({ features, totals, election_lookups }: MapClientProps) {
  const t = useTranslations("heatmap");
  const [display_mode, set_display_mode] = useState<DiffDisplayMode>("absolute");
  const [show_modal, set_show_modal] = useState(true);
  const [modal_fading, set_modal_fading] = useState(false);

  /**
   * Dismiss the welcome modal with a fade-out animation.
   * Marks modal as fading, then removes it after transition completes.
   */
  const dismiss_modal = useCallback(() => {
    console.log("[map_client] Dismissing welcome modal");
    set_modal_fading(true);
    setTimeout(() => set_show_modal(false), 300);
  }, []);

  console.log(`[map_client] Rendering root stats page, mode=${display_mode}`);

  const nationwide = useMemo(
    () => compute_region_stats(features, election_lookups.diff),
    [features, election_lookups.diff]
  );

  const regional = useMemo(() => {
    const groups = group_by_region(features);
    const result: Record<RegionKey, RegionDiffStats> = {} as Record<RegionKey, RegionDiffStats>;
    for (const key of REGION_ORDER) {
      result[key] = compute_region_stats(groups[key], election_lookups.diff);
    }
    return result;
  }, [features, election_lookups.diff]);

  /** Build WinnerDiffItem[] from features + diff/winner lookups for pie chart. */
  const winner_diff_items = useMemo((): WinnerDiffItem[] => {
    console.log("[map_client] Computing winner diff items for pie chart");
    const items: WinnerDiffItem[] = [];

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) continue;

      const winner = election_lookups.winners[cons_data.cons_id];

      items.push({
        diff_percent: diff.diff_percent,
        winner_party: winner?.party_name || "-",
        winner_color: winner?.party_color || "#666",
        prov_name_th: cons_data.prov_name_th,
        cons_no: cons_data.cons_no,
        cons_id: cons_data.cons_id,
      });
    }

    console.log(`[map_client] Built ${items.length} winner diff items`);
    return items;
  }, [features, election_lookups]);

  /** Aggregate forensic metrics from all constituencies. */
  const forensic_summary = useMemo(() => {
    console.log("[map_client] Computing forensic summary");
    let total_invalid_diff = 0;
    let total_blank_diff = 0;
    let sum_invalid_diff_pct = 0;
    let incomplete_count = 0;
    let count = 0;

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;
      const forensics = election_lookups.forensics?.[cons_data.cons_id];
      if (!forensics) continue;
      count++;
      total_invalid_diff += Math.abs(forensics.mp_invalid_votes - forensics.pl_invalid_votes);
      total_blank_diff += Math.abs(forensics.mp_blank_votes - forensics.pl_blank_votes);
      sum_invalid_diff_pct += Math.abs(forensics.invalid_diff);
      if (forensics.percent_count < 100) incomplete_count++;
    }

    return {
      total_invalid_diff,
      total_blank_diff,
      avg_invalid_diff_pct: count > 0 ? sum_invalid_diff_pct / count : 0,
      incomplete_count,
    };
  }, [features, election_lookups.forensics]);

  const dot_colors = get_diff_dot_colors();
  const is_pct = display_mode === "percent";

  /**
   * Format the total diff value based on current display mode.
   *
   * @param stats - Region stats to format.
   * @returns Formatted string — absolute count or percentage.
   */
  const format_total_diff = (stats: RegionDiffStats): string => {
    if (is_pct) {
      return `${compute_overall_pct(stats).toFixed(2)}%`;
    }
    return stats.sum_abs_count.toLocaleString();
  };

  /**
   * Render 5 metric cards for a stats group in a 3-column grid.
   * Last card shows total diff in current mode (absolute or %).
   *
   * @param stats - Aggregated stats for one region or nationwide.
   * @returns Grid of metric card elements.
   */
  const render_metric_cards = (stats: RegionDiffStats) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {/* Mismatch fraction */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_mismatch")}</div>
        <div className="text-sm font-bold text-text-primary">
          {stats.mismatch_count}<span className="text-text-muted font-normal">/{stats.total}</span>
        </div>
      </div>

      {/* Avg % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_avg_pct")}</div>
        <div className="text-sm font-bold text-text-primary">{stats.avg_percent.toFixed(2)}%</div>
      </div>

      {/* Max % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_max_pct")}</div>
        <div className="text-sm font-bold" style={{ color: dot_colors.positive }}>
          +{stats.max_percent.toFixed(2)}%
        </div>
      </div>

      {/* Min % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_min_pct")}</div>
        <div className="text-sm font-bold" style={{ color: dot_colors.negative }}>
          {stats.min_percent.toFixed(2)}%
        </div>
      </div>

      {/* Total diff — absolute or % based on mode */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center col-span-2">
        <div className="text-[10px] text-text-muted mb-1">
          {is_pct ? t("stats_total_pct_diff") : t("stats_total_abs_diff")}
        </div>
        <div className="text-sm font-bold text-accent">{format_total_diff(stats)}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Welcome modal overlay */}
      {show_modal && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
            modal_fading ? "opacity-0" : "opacity-100"
          }`}
          onClick={dismiss_modal}
        >
          {/* Backdrop blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

          {/* Modal content */}
          <div
            className={`relative z-10 max-w-2xl mx-6 text-center transition-all duration-300 ${
              modal_fading ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Election date badge */}
            <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-accent/20 border border-accent/40">
              <span className="text-sm font-medium text-accent">8 Feb 2025</span>
            </div>

            {/* Intro text — large and prominent */}
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-relaxed mb-8">
              {t("stats_intro")}
            </p>

            {/* Dismiss button */}
            <button
              onClick={dismiss_modal}
              className="px-8 py-3 text-lg font-semibold rounded-full bg-accent text-white hover:bg-accent-light transition-colors shadow-lg shadow-accent/30"
            >
              {t("modal_dismiss")}
            </button>
          </div>
        </div>
      )}

      {/* Floating topbar */}
      <TopBar />

      {/* Main content area with top padding for topbar clearance */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-20 pb-12">
        {/* Page header */}
        <h1 className="text-xl font-bold text-text-primary mb-1">{t("stats_title")}</h1>
        <p className="text-sm text-text-muted mb-3">
          {totals.provinces} {t("stats_nationwide")} · {totals.constituencies} {t("stats_mismatch").toLowerCase()}
        </p>

        {/* Intro paragraph — bigger text */}
        <p className="text-lg md:text-xl text-text-secondary leading-relaxed mb-6 font-medium">
          {t("stats_intro")}
        </p>

        {/* Mode toggle: absolute vs percentage */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => set_display_mode("absolute")}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              !is_pct
                ? "bg-accent text-white border-accent"
                : "bg-bg-secondary text-text-muted border-border-primary hover:border-accent"
            }`}
          >
            {t("stats_mode_absolute")}
          </button>
          <button
            onClick={() => set_display_mode("percent")}
            className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
              is_pct
                ? "bg-accent text-white border-accent"
                : "bg-bg-secondary text-text-muted border-border-primary hover:border-accent"
            }`}
          >
            {t("stats_mode_percent")}
          </button>
        </div>

        {/* Winner Diff Piechart — MPs winning in high-diff areas */}
        <div className="mb-10">
          <WinnerDiffPiechart items={winner_diff_items} />
        </div>

        {/* Hero: Total diff — big prominent number */}
        <div className="mb-10 bg-bg-secondary border border-border-primary rounded-2xl p-5 sm:p-8 text-center">
          <div className="text-sm text-text-muted mb-3">
            {is_pct ? t("stats_total_pct_diff") : t("stats_total_abs_diff")}
          </div>
          <div className="text-3xl sm:text-5xl font-extrabold text-accent tracking-tight">
            {is_pct
              ? `${compute_overall_pct(nationwide).toFixed(2)}%`
              : nationwide.sum_abs_count.toLocaleString()
            }
          </div>
          <div className="text-xs text-text-muted mt-3">
            {is_pct
              ? `Σ |diff| / avg(turnout) × 100 · ${nationwide.mismatch_count}/${nationwide.total} ${t("stats_mismatch").toLowerCase()}`
              : `Σ |diff| · ${nationwide.mismatch_count}/${nationwide.total} ${t("stats_mismatch").toLowerCase()}`
            }
          </div>
        </div>

        {/* Nationwide section — larger cards */}
        <div className="mb-10">
          <div className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
            {t("stats_nationwide")}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Mismatch fraction */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
              <div className="text-xs text-text-muted mb-2">{t("stats_mismatch")}</div>
              <div className="text-2xl font-bold text-text-primary">
                {nationwide.mismatch_count}<span className="text-text-muted font-normal text-lg">/{nationwide.total}</span>
              </div>
            </div>

            {/* Avg % */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
              <div className="text-xs text-text-muted mb-2">{t("stats_avg_pct")}</div>
              <div className="text-2xl font-bold text-text-primary">{nationwide.avg_percent.toFixed(2)}%</div>
            </div>

            {/* Max % */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
              <div className="text-xs text-text-muted mb-2">{t("stats_max_pct")}</div>
              <div className="text-2xl font-bold" style={{ color: dot_colors.positive }}>
                +{nationwide.max_percent.toFixed(2)}%
              </div>
            </div>

            {/* Min % */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
              <div className="text-xs text-text-muted mb-2">{t("stats_min_pct")}</div>
              <div className="text-2xl font-bold" style={{ color: dot_colors.negative }}>
                {nationwide.min_percent.toFixed(2)}%
              </div>
            </div>

            {/* Total diff for nationwide — mode-aware */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center col-span-2">
              <div className="text-xs text-text-muted mb-2">
                {is_pct ? t("stats_total_pct_diff") : t("stats_total_abs_diff")}
              </div>
              <div className="text-2xl font-bold text-accent">{format_total_diff(nationwide)}</div>
            </div>
          </div>
        </div>

        {/* Forensic: Ballot integrity section */}
        {forensic_summary.total_invalid_diff > 0 && (
          <div className="mb-10">
            <div className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
              {t("forensics_title")}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
                <div className="text-xs text-text-muted mb-2">{t("forensics_total_invalid")}</div>
                <div className="text-2xl font-bold text-red-400">{forensic_summary.total_invalid_diff.toLocaleString()}</div>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
                <div className="text-xs text-text-muted mb-2">{t("forensics_total_blank")}</div>
                <div className="text-2xl font-bold text-yellow-400">{forensic_summary.total_blank_diff.toLocaleString()}</div>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
                <div className="text-xs text-text-muted mb-2">{t("forensics_avg_invalid_pct")}</div>
                <div className="text-2xl font-bold text-orange-400">{forensic_summary.avg_invalid_diff_pct.toFixed(2)}%</div>
              </div>
              <div className="bg-bg-secondary border border-border-primary rounded-xl p-5 text-center">
                <div className="text-xs text-text-muted mb-2">{t("forensics_incomplete")}</div>
                <div className="text-2xl font-bold text-purple-400">{forensic_summary.incomplete_count}</div>
              </div>
            </div>
          </div>
        )}

        {/* Per-region sections */}
        {REGION_ORDER.map((key) => (
          <div key={key} className="mb-6">
            {/* Region divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border-primary" />
              <span className="text-xs font-semibold text-text-muted whitespace-nowrap">
                {REGION_NAMES[key]}
              </span>
              <div className="flex-1 h-px bg-border-primary" />
            </div>
            {render_metric_cards(regional[key])}
          </div>
        ))}
      </div>
    </div>
  );
}
