"use client";

/**
 * DiffHeatmapClient - Client orchestrator for the diff heatmap page.
 *
 * @description Renders a map colored by the net difference between constituency
 *              MP turnout and party list turnout. Uses the standard TopBar (same
 *              as main map page) with a separate floating sub-bar below for diff
 *              tab toggle controls. D3 diverging color scale: red (negative) →
 *              white (zero) → blue (positive).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import * as d3 from "d3";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ConstituencyData,
  ElectionLookups,
  DiffMetric,
} from "@/types/constituency";
import {
  get_map_colors,
  DIFF_COLOR_SCHEME,
  get_diff_dot_colors,
} from "@/lib/constants";
import ThailandMap from "@/components/thailand_map";
import TopBar from "@/components/topbar";
import DiffStatsPanel from "@/components/diff_stats_panel";

interface DiffHeatmapClientProps {
  /** Enriched constituency GeoJSON features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Election result lookups including diff data. */
  election_lookups: ElectionLookups;
}

/**
 * Compute the diverging color scale domain extent from diff data.
 *
 * @param diff_lookup - Record of cons_id → ConsDiffData.
 * @param metric - Which diff metric to compute extent for.
 * @returns Symmetric extent [min, max] centered at 0.
 */
function compute_diff_extent(
  diff_lookup: ElectionLookups["diff"],
  metric: DiffMetric
): [number, number] {
  console.log(`[diff_heatmap] Computing extent for ${metric}`);
  const values = Object.values(diff_lookup).map((d) => d[metric]);
  if (values.length === 0) return [-1, 1];

  const min = d3.min(values) ?? 0;
  const max = d3.max(values) ?? 0;
  const abs_max = Math.max(Math.abs(min), Math.abs(max)) || 1;
  return [-abs_max, abs_max];
}


// ── Tooltip sub-component ────────────────────

interface DiffTooltipProps {
  /** Constituency data for the hovered feature. */
  data: ConstituencyData | null;
  /** Mouse event for positioning. */
  mouse_event: MouseEvent | null;
  /** Active diff metric. */
  active_metric: DiffMetric;
  /** Election lookups with diff data. */
  election_lookups: ElectionLookups;
}

/**
 * DiffTooltip - Shows MP turnout, party list turnout, and net diff.
 *
 * @param data - Hovered constituency data.
 * @param mouse_event - Mouse event for positioning.
 * @param active_metric - Current diff metric.
 * @param election_lookups - Lookups containing diff data.
 * @returns Positioned tooltip or null when not hovering.
 */
function DiffTooltip({
  data,
  mouse_event,
  active_metric,
  election_lookups,
}: DiffTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("heatmap");

  useEffect(() => {
    if (!ref.current || !mouse_event) return;
    const tt = ref.current;
    const rect = tt.getBoundingClientRect();
    const margin = 16;
    let x = mouse_event.clientX + margin;
    let y = mouse_event.clientY - margin;

    if (x + rect.width > window.innerWidth - margin) {
      x = mouse_event.clientX - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (y < margin) y = margin;

    tt.style.left = `${x}px`;
    tt.style.top = `${y}px`;
  }, [mouse_event]);

  if (!data || !mouse_event) return null;

  const diff_data = data.cons_id
    ? election_lookups.diff[data.cons_id]
    : null;
  const winner = data.cons_id
    ? election_lookups.winners[data.cons_id]
    : null;

  if (!diff_data) return null;

  const diff_value =
    active_metric === "diff_count"
      ? diff_data.diff_count
      : diff_data.diff_percent;
  const is_positive = diff_value > 0;
  const arrow = is_positive ? "▲" : diff_value < 0 ? "▼" : "—";
  const dot_colors = get_diff_dot_colors();
  const diff_color = is_positive
    ? dot_colors.positive
    : diff_value < 0
      ? dot_colors.negative
      : dot_colors.neutral;

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-[100] min-w-[220px] max-w-[340px] rounded-xl border border-border-primary bg-bg-secondary px-4 py-3.5 shadow-[0_8px_32px_var(--shadow-tooltip)]"
    >
      {/* Header */}
      <div className="text-base font-bold text-text-primary">
        {data.prov_name_th} {t("constituency")} {data.cons_no}
      </div>
      <div className="text-xs text-text-muted mb-2">
        {data.prov_name_en} - Constituency {data.cons_no}
      </div>

      {/* Winner party context */}
      {winner && (
        <>
          <div className="h-px bg-border-primary my-1.5" />
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: winner.party_color }}
            />
            <span className="text-xs text-text-secondary">
              {winner.party_name} — {winner.candidate_name}
            </span>
          </div>
        </>
      )}

      <div className="h-px bg-border-primary my-1.5" />

      {/* MP turnout */}
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("mp_turnout")}</span>
        <span className="font-semibold text-text-primary">
          {diff_data.mp_turn_out.toLocaleString()} ({diff_data.mp_percent_turn_out.toFixed(1)}%)
        </span>
      </div>

      {/* Party list turnout */}
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("party_list_turnout")}</span>
        <span className="font-semibold text-text-primary">
          {diff_data.party_list_turn_out.toLocaleString()} ({diff_data.party_list_percent_turn_out.toFixed(1)}%)
        </span>
      </div>

      <div className="h-px bg-border-primary my-1.5" />

      {/* Net diff */}
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary font-medium">{t("diff")}</span>
        <span className="font-bold text-base" style={{ color: diff_color }}>
          {arrow}{" "}
          {active_metric === "diff_count"
            ? `${Math.abs(diff_data.diff_count).toLocaleString()}`
            : `${Math.abs(diff_data.diff_percent).toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
}

// ── Legend sub-component ─────────────────────

interface DiffLegendProps {
  /** Current diff metric for labels. */
  active_metric: DiffMetric;
  /** Domain extent [min, max] for labels. */
  extent: [number, number];
}

/**
 * DiffLegend - Blue→purple color scale legend.
 *
 * @param active_metric - Current diff metric.
 * @param extent - Scale extent.
 * @returns Legend panel with gradient and labels.
 */
function DiffLegend({ active_metric, extent }: DiffLegendProps) {
  const t = useTranslations("heatmap");

  console.log("[diff_legend] Rendering blue-purple + dot legend");

  const abs_max = Math.max(Math.abs(extent[0]), Math.abs(extent[1]));
  const format_max = (v: number): string => {
    if (active_metric === "diff_count") return Math.round(v).toLocaleString();
    return `${v.toFixed(1)}%`;
  };
  const dot_colors = get_diff_dot_colors();

  return (
    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 bg-bg-tertiary border border-border-primary rounded-xl px-3 py-2 sm:px-4 sm:py-3 z-50 max-w-[calc(100%-2rem)] sm:max-w-none">
      <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider mb-2">
        {active_metric === "diff_count" ? t("tab_count") : t("tab_percent")}
      </div>

      {/* Blue → purple scale (magnitude) */}
      <div
        className="h-3 rounded overflow-hidden min-w-[200px]"
        style={{
          background: `linear-gradient(to right, ${DIFF_COLOR_SCHEME[0]}, ${DIFF_COLOR_SCHEME[3]}, ${DIFF_COLOR_SCHEME[5]}, ${DIFF_COLOR_SCHEME[8]})`,
        }}
      />
      <div className="flex justify-between mt-1 text-[10px] text-text-muted">
        <span>0</span>
        <span>{format_max(abs_max)}</span>
      </div>

      {/* Dot direction indicators */}
      <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-border-primary">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot_colors.positive }} />
          <span className="text-[10px] text-text-muted">{t("legend_more")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot_colors.negative }} />
          <span className="text-[10px] text-text-muted">{t("legend_less")}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main client component ───────────────────

/**
 * DiffHeatmapClient - Page-level client orchestrator.
 *
 * @description Uses standard TopBar + separate floating sub-bar for diff tabs.
 *              Manages diverging color scale, map, tooltip, and legend.
 * @param features - Enriched constituency GeoJSON features.
 * @param election_lookups - Election result lookups including diff data.
 * @returns Full heatmap UI with shared topbar, map, tooltip, and legend.
 */
export default function DiffHeatmapClient({
  features,
  election_lookups,
}: DiffHeatmapClientProps) {
  const [active_tab, set_active_tab] = useState<DiffMetric>("diff_count");
  const [hovered, set_hovered] = useState<ConstituencyData | null>(null);
  const [mouse_event, set_mouse_event] = useState<MouseEvent | null>(null);
  const t = useTranslations("heatmap");
  const locale = useLocale();

  console.log("[diff_heatmap] Rendering with tab:", active_tab);

  /**
   * Handle constituency hover from the map.
   *
   * @param data - Constituency data or null on unhover.
   * @param event - Mouse event for positioning.
   */
  const handle_hover = useCallback(
    (data: ConstituencyData | null, event: MouseEvent | null) => {
      set_hovered(data);
      set_mouse_event(event);
    },
    []
  );

  /** Compute diverging extent for current metric. */
  const extent = useMemo(
    () => compute_diff_extent(election_lookups.diff, active_tab),
    [election_lookups.diff, active_tab]
  );

  /** Blue-purple quantize scale: magnitude of diff → blue→purple (more diff = more solid). */
  const diff_scale = useMemo(() => {
    console.log(`[diff_heatmap] Building blue-purple scale for ${active_tab}`);
    const abs_max = Math.max(Math.abs(extent[0]), Math.abs(extent[1])) || 1;
    return d3
      .scaleQuantize<string>()
      .domain([0, abs_max])
      .range([...DIFF_COLOR_SCHEME]);
  }, [extent, active_tab]);

  /** Blue-purple fill color: more diff = more solid purple. */
  const get_fill_color = useCallback(
    (cons_data: ConstituencyData | null): string => {
      if (!cons_data) return get_map_colors().null_color;
      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) return get_map_colors().null_color;
      return diff_scale(Math.abs(diff[active_tab]));
    },
    [election_lookups.diff, diff_scale, active_tab]
  );

  /**
   * Label for each constituency centroid showing diff_percent.
   *
   * @param cons_data - Constituency data.
   * @returns Formatted percentage string or null.
   */
  const get_label = useCallback(
    (cons_data: ConstituencyData | null): string | null => {
      if (!cons_data) return null;
      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) return null;
      const pct = diff.diff_percent;
      const sign = pct > 0 ? "+" : "";
      return `${sign}${pct.toFixed(1)}%`;
    },
    [election_lookups.diff]
  );

  /** Direction dot color: green (MP more), red (party list more), null (near zero). */
  const get_dot_color = useCallback(
    (cons_data: ConstituencyData | null): string | null => {
      if (!cons_data) return null;
      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) return null;
      const val = diff[active_tab];
      const dot_colors = get_diff_dot_colors();
      if (val > 0) return dot_colors.positive;
      if (val < 0) return dot_colors.negative;
      return dot_colors.neutral;
    },
    [election_lookups.diff, active_tab]
  );

  const tabs: { key: DiffMetric; label_key: string }[] = [
    { key: "diff_count", label_key: "tab_count" },
    { key: "diff_percent", label_key: "tab_percent" },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Full-screen map with custom fill */}
      <ThailandMap
        features={features}
        metric="registered_voters"
        on_hover={handle_hover}
        get_fill_color={get_fill_color}
        get_dot_color={get_dot_color}
        get_label={get_label}
      />

      {/* TopBar aligned left (right side occupied by stats panel) */}
      <TopBar align="left" />

      {/* Sub-bar: diff tab toggle (floating below TopBar, also left-aligned) */}
      <div className="absolute top-[4.5rem] left-4 z-[89]">
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          {/* Diff tab toggles */}
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => set_active_tab(tab.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                active_tab === tab.key
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              {tab.key === "diff_count" ? (
                /* Hash/number icon */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <line x1="4" y1="9" x2="20" y2="9" />
                  <line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" />
                  <line x1="16" y1="3" x2="14" y2="21" />
                </svg>
              ) : (
                /* Percent icon */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <line x1="19" y1="5" x2="5" y2="19" />
                  <circle cx="6.5" cy="6.5" r="2.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              )}
              {t(tab.label_key)}
            </button>
          ))}

        </div>
      </div>

      {/* Tooltip */}
      <DiffTooltip
        data={hovered}
        mouse_event={mouse_event}
        active_metric={active_tab}
        election_lookups={election_lookups}
      />

      {/* Legend */}
      <DiffLegend active_metric={active_tab} extent={extent} />

      {/* Stats panel (always visible, right side) */}
      <DiffStatsPanel
        features={features}
        diff_lookup={election_lookups.diff}
      />
    </div>
  );
}
