"use client";

/**
 * DiffStatsPanel - Toggleable right-side statistics panel with drilldown.
 *
 * @description Slide-over panel showing mismatch metrics. Defaults to nationwide
 *              overview with per-region breakdown. When a constituency is hovered
 *              or clicked on the map, drills down to show that area's specific
 *              diff data plus its region's aggregated stats.
 *              Toggle button allows opening/closing the panel.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ConstituencyData,
  ElectionLookups,
} from "@/types/constituency";
import {
  get_diff_dot_colors,
  PROV_ID_TO_REGION,
  REGION_ORDER,
  REGION_NAMES,
  type RegionKey,
} from "@/lib/constants";

// ── Types ──────────────────────────────────

/** Aggregated diff statistics for a region or nationwide. */
export interface RegionDiffStats {
  /** Total constituencies in this group. */
  total: number;
  /** Count where diff_count !== 0 (mismatch). */
  mismatch_count: number;
  /** Average absolute diff_percent. */
  avg_percent: number;
  /** Max diff_percent (most positive = MP stronger). */
  max_percent: number;
  /** Min diff_percent (most negative = party list stronger). */
  min_percent: number;
  /** Max absolute diff_count. */
  max_count: number;
  /** Min absolute diff_count (closest to zero). */
  min_count: number;
  /** Sum of |diff_count| across all constituencies (total absolute diff). */
  sum_abs_count: number;
  /** Sum of |diff_percent| across all constituencies (total % diff). */
  sum_abs_percent: number;
  /** Total MP turnout across all constituencies in this group. */
  total_mp_turnout: number;
  /** Total party list turnout across all constituencies in this group. */
  total_pl_turnout: number;
  /** Constituency with maximum absolute diff. */
  max_cons_id: string;
  /** Constituency with minimum absolute diff. */
  min_cons_id: string;
}

// ── Computation helpers ────────────────────

/**
 * Compute aggregated diff stats for a set of constituency features.
 *
 * @param features - Constituency features to aggregate.
 * @param diff_lookup - Diff data lookup.
 * @returns Aggregated stats object.
 */
export function compute_region_stats(
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[],
  diff_lookup: ElectionLookups["diff"]
): RegionDiffStats {
  let total = 0;
  let mismatch_count = 0;
  let sum_abs_percent = 0;
  let sum_abs_count_total = 0;
  let total_mp_turnout = 0;
  let total_pl_turnout = 0;
  let max_percent = -Infinity;
  let min_percent = Infinity;
  let max_abs_count = -Infinity;
  let min_abs_count = Infinity;
  let max_cons_id = "";
  let min_cons_id = "";

  for (const f of features) {
    const data = f.properties._cons_data;
    if (!data) continue;
    const diff = diff_lookup[data.cons_id];
    if (!diff) continue;

    total++;
    if (diff.diff_count !== 0) mismatch_count++;

    sum_abs_percent += Math.abs(diff.diff_percent);
    sum_abs_count_total += Math.abs(diff.diff_count);
    total_mp_turnout += diff.mp_turn_out;
    total_pl_turnout += diff.party_list_turn_out;

    if (diff.diff_percent > max_percent) {
      max_percent = diff.diff_percent;
    }
    if (diff.diff_percent < min_percent) {
      min_percent = diff.diff_percent;
    }

    const abs_count = Math.abs(diff.diff_count);
    if (abs_count > max_abs_count) {
      max_abs_count = abs_count;
      max_cons_id = data.cons_id;
    }
    if (abs_count < min_abs_count) {
      min_abs_count = abs_count;
      min_cons_id = data.cons_id;
    }
  }

  return {
    total,
    mismatch_count,
    avg_percent: total > 0 ? sum_abs_percent / total : 0,
    max_percent: max_percent === -Infinity ? 0 : max_percent,
    min_percent: min_percent === Infinity ? 0 : min_percent,
    max_count: max_abs_count === -Infinity ? 0 : max_abs_count,
    min_count: min_abs_count === Infinity ? 0 : min_abs_count,
    sum_abs_count: sum_abs_count_total,
    sum_abs_percent,
    total_mp_turnout,
    total_pl_turnout,
    max_cons_id,
    min_cons_id,
  };
}

/**
 * Group features by Thai region.
 *
 * @param features - All constituency features.
 * @returns Map of region key to feature arrays.
 */
export function group_by_region(
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[]
): Record<RegionKey, GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[]> {
  const groups: Record<RegionKey, GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[]> = {
    north: [], northeast: [], central: [], east: [], west: [], south: [],
  };

  for (const f of features) {
    const prov_id = f.properties._cons_data?.prov_id;
    if (!prov_id) continue;
    const region = PROV_ID_TO_REGION[prov_id];
    if (region) groups[region].push(f);
  }

  return groups;
}

// ── Component ──────────────────────────────

export interface DiffStatsPanelProps {
  /** All constituency features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Diff data lookup. */
  diff_lookup: ElectionLookups["diff"];
  /** Whether the panel is open. */
  is_open: boolean;
  /** Toggle callback for open/close. */
  on_toggle: () => void;
  /** Currently hovered/selected constituency (for drilldown). */
  selected_cons?: ConstituencyData | null;
}

/**
 * DiffStatsPanel - Toggleable right panel with regional diff statistics and drilldown.
 *
 * @param features - Constituency features for aggregation.
 * @param diff_lookup - Diff data by cons_id.
 * @param is_open - Panel open state.
 * @param on_toggle - Toggle open/close callback.
 * @param selected_cons - Hovered/clicked constituency for drilldown view.
 * @returns Stats panel element with toggle button.
 */
export default function DiffStatsPanel({
  features,
  diff_lookup,
  is_open,
  on_toggle,
  selected_cons,
}: DiffStatsPanelProps) {
  const t = useTranslations("heatmap");

  console.log("[diff_stats] Rendering stats panel, open:", is_open, "selected:", selected_cons?.cons_id);

  const nationwide = useMemo(
    () => compute_region_stats(features, diff_lookup),
    [features, diff_lookup]
  );

  const regional_groups = useMemo(
    () => group_by_region(features),
    [features]
  );

  const regional = useMemo(() => {
    const result: Record<RegionKey, RegionDiffStats> = {} as Record<RegionKey, RegionDiffStats>;
    for (const key of REGION_ORDER) {
      result[key] = compute_region_stats(regional_groups[key], diff_lookup);
    }
    return result;
  }, [regional_groups, diff_lookup]);

  /** Determine the region of the selected constituency. */
  const selected_region: RegionKey | null = useMemo(() => {
    if (!selected_cons) return null;
    return PROV_ID_TO_REGION[selected_cons.prov_id] ?? null;
  }, [selected_cons]);

  /** Get diff data for the selected constituency. */
  const selected_diff = selected_cons ? diff_lookup[selected_cons.cons_id] : null;

  const dot_colors = get_diff_dot_colors();

  /**
   * Render individual metric cards for a stats group.
   *
   * @param stats - Aggregated stats.
   * @returns Metric card grid element.
   */
  const render_metric_cards = (stats: RegionDiffStats) => (
    <div className="grid grid-cols-3 gap-2 mb-1">
      {/* Mismatch fraction */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_mismatch")}</div>
        <div className="text-sm font-bold text-text-primary">
          {stats.mismatch_count}<span className="text-text-muted font-normal">/{stats.total}</span>
        </div>
      </div>

      {/* Avg % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_avg_pct")}</div>
        <div className="text-sm font-bold text-text-primary">{stats.avg_percent.toFixed(2)}%</div>
      </div>

      {/* Max % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_max_pct")}</div>
        <div className="text-sm font-bold" style={{ color: dot_colors.positive }}>
          +{stats.max_percent.toFixed(2)}%
        </div>
      </div>

      {/* Min % */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_min_pct")}</div>
        <div className="text-sm font-bold" style={{ color: dot_colors.negative }}>
          {stats.min_percent.toFixed(2)}%
        </div>
      </div>

      {/* Max count */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_max_count")}</div>
        <div className="text-sm font-bold text-text-primary">{stats.max_count.toLocaleString()}</div>
      </div>

      {/* Min count */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
        <div className="text-[10px] text-text-muted mb-1">{t("stats_min_count")}</div>
        <div className="text-sm font-bold text-text-primary">{stats.min_count.toLocaleString()}</div>
      </div>
    </div>
  );

  /**
   * Render area-level drilldown card for the selected constituency.
   *
   * @returns Area detail card or null.
   */
  const render_area_drilldown = () => {
    if (!selected_cons || !selected_diff) return null;

    const sign_count = selected_diff.diff_count > 0 ? "+" : "";
    const sign_pct = selected_diff.diff_percent > 0 ? "+" : "";
    const pct_color =
      selected_diff.diff_percent > 0
        ? dot_colors.positive
        : selected_diff.diff_percent < 0
          ? dot_colors.negative
          : dot_colors.neutral;

    return (
      <div className="mb-4">
        {/* Area header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: pct_color }}
          />
          <span className="text-sm font-bold text-text-primary">
            {selected_cons.prov_name_th} เขต {selected_cons.cons_no}
          </span>
        </div>

        {/* Area-level diff stats */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
            <div className="text-[10px] text-text-muted mb-1">ผลต่าง (จำนวน)</div>
            <div className="text-lg font-bold" style={{ color: pct_color }}>
              {sign_count}{selected_diff.diff_count.toLocaleString()}
            </div>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-3 text-center">
            <div className="text-[10px] text-text-muted mb-1">ผลต่าง (%)</div>
            <div className="text-lg font-bold" style={{ color: pct_color }}>
              {sign_pct}{selected_diff.diff_percent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Turnout breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-text-muted mb-1">โหวต ส.ส.เขต</div>
            <div className="text-sm font-bold text-text-primary">
              {selected_diff.mp_turn_out.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted">
              {selected_diff.mp_percent_turn_out.toFixed(2)}%
            </div>
          </div>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-text-muted mb-1">โหวตบัญชีรายชื่อ</div>
            <div className="text-sm font-bold text-text-primary">
              {selected_diff.party_list_turn_out.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted">
              {selected_diff.party_list_percent_turn_out.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Area meta */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-text-muted">
          <span>ผู้มีสิทธิ: {selected_cons.registered_voters.toLocaleString()}</span>
          <span>หน่วยเลือกตั้ง: {selected_cons.vote_stations}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toggle button — always visible on right edge */}
      <button
        onClick={on_toggle}
        className={`hidden md:flex absolute top-4 z-[91] items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-3 py-2 shadow-[0_4px_24px_var(--shadow-tooltip)] text-xs font-medium transition-all cursor-pointer ${
          is_open
            ? "right-[35%] mr-2 text-accent"
            : "right-4 text-text-secondary hover:text-accent"
        }`}
        title={t("stats_toggle")}
        aria-label={t("stats_toggle")}
      >
        {/* Panel icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
        {t("stats_toggle")}
        {/* Chevron direction */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${is_open ? "rotate-0" : "rotate-180"}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Slide-over panel */}
      <div
        className={`hidden md:block absolute top-0 right-0 h-full w-[35%] min-w-[320px] z-[88] transition-transform duration-300 ease-in-out ${
          is_open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-bg-primary/95 backdrop-blur-lg border-l border-border-primary shadow-[-4px_0_32px_var(--shadow-tooltip)] overflow-y-auto">
          <div className="p-4 pt-6">
            {/* Panel header */}
            <h2 className="text-base font-bold text-text-primary mb-4">{t("stats_title")}</h2>

            {/* Drilldown view when a constituency is selected */}
            {selected_cons && selected_diff ? (
              <>
                {/* Area-level detail */}
                {render_area_drilldown()}

                {/* Region divider + region stats */}
                {selected_region && (
                  <>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-border-primary" />
                      <span className="text-[11px] font-semibold text-accent whitespace-nowrap">
                        {REGION_NAMES[selected_region]}
                      </span>
                      <div className="flex-1 h-px bg-border-primary" />
                    </div>
                    {render_metric_cards(regional[selected_region])}
                  </>
                )}

                {/* Nationwide divider + nationwide stats */}
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-border-primary" />
                  <span className="text-[11px] font-semibold text-text-muted whitespace-nowrap">
                    {t("stats_nationwide")}
                  </span>
                  <div className="flex-1 h-px bg-border-primary" />
                </div>
                {render_metric_cards(nationwide)}
              </>
            ) : (
              <>
                {/* Default: nationwide + all regions */}
                <div className="text-xs font-semibold text-text-primary mb-2">{t("stats_nationwide")}</div>
                {render_metric_cards(nationwide)}

                {/* Per-region stats separated by dividers */}
                {REGION_ORDER.map((key) => (
                  <div key={key}>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-border-primary" />
                      <span className="text-[11px] font-semibold text-text-muted whitespace-nowrap">
                        {REGION_NAMES[key]}
                      </span>
                      <div className="flex-1 h-px bg-border-primary" />
                    </div>
                    {render_metric_cards(regional[key])}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
