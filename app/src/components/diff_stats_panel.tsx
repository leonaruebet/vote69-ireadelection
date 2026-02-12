"use client";

/**
 * DiffStatsPanel - Regional diff statistics panel.
 *
 * @description 35% right-side panel (always visible) showing mismatch metrics
 *              aggregated nationwide and broken down by Thai ภาค (region).
 *              Shared across root map page and diff-count page.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
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
}

/**
 * DiffStatsPanel - Always-visible right panel with regional diff statistics.
 *
 * @param features - Constituency features for aggregation.
 * @param diff_lookup - Diff data by cons_id.
 * @returns Stats panel element.
 */
export default function DiffStatsPanel({ features, diff_lookup }: DiffStatsPanelProps) {
  const t = useTranslations("heatmap");

  console.log("[diff_stats] Rendering stats panel");

  const nationwide = useMemo(
    () => compute_region_stats(features, diff_lookup),
    [features, diff_lookup]
  );

  const regional = useMemo(() => {
    const groups = group_by_region(features);
    const result: Record<RegionKey, RegionDiffStats> = {} as Record<RegionKey, RegionDiffStats>;
    for (const key of REGION_ORDER) {
      result[key] = compute_region_stats(groups[key], diff_lookup);
    }
    return result;
  }, [features, diff_lookup]);

  const dot_colors = get_diff_dot_colors();

  /**
   * Render individual metric cards for a stats group.
   *
   * @param stats - Aggregated stats.
   * @returns Array of metric card elements.
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

  return (
    <div className="absolute top-0 right-0 h-full w-[35%] min-w-[320px] z-[88]">
      <div className="h-full bg-bg-primary/95 backdrop-blur-lg border-l border-border-primary shadow-[-4px_0_32px_var(--shadow-tooltip)] overflow-y-auto">
        <div className="p-4 pt-6">
          {/* Panel header */}
          <h2 className="text-base font-bold text-text-primary mb-4">{t("stats_title")}</h2>

          {/* Nationwide stats */}
          <div className="text-xs font-semibold text-text-primary mb-2">{t("stats_nationwide")}</div>
          {render_metric_cards(nationwide)}

          {/* Per-region stats separated by dividers */}
          {REGION_ORDER.map((key) => (
            <div key={key}>
              {/* ── Region divider ── */}
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
        </div>
      </div>
    </div>
  );
}
