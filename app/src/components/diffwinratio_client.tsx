"use client";

/**
 * DiffWinRatioClient - Scatter + bubble plot for area turnout diff analysis.
 *
 * @description Interactive D3 scatter-bubble chart where each constituency
 *              is a bubble showing the relationship between total area
 *              turnout diff and the winner's vote share.
 *              Supports filtering by winning party (พรรค).
 *
 * X axis: |mp_turn_out − party_list_turn_out| (absolute area turnout diff, linear)
 * Y axis: % of votes the winner got from total area turnout
 * Bubble size: total votes of the winning candidate
 * Color: winning party color
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import * as d3 from "d3";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ElectionLookups,
} from "@/types/constituency";
import { get_css_var } from "@/lib/constants";
import TopBar from "@/components/topbar";

// ── Data point type ─────────────────────────

/** Single data point for the scatter-bubble chart. */
interface BubbleDataPoint {
  /** ECT constituency ID. */
  cons_id: string;
  /** Thai province name. */
  prov_name_th: string;
  /** Constituency number within province. */
  cons_no: number;
  /** X axis: |mp_turn_out − party_list_turn_out| — absolute area turnout diff. */
  area_diff_abs: number;
  /** X axis percentage: |mp_percent − pl_percent|. */
  area_diff_pct: number;
  /** Total MP ballot turnout count for this area. */
  mp_turn_out: number;
  /** Total party list ballot turnout count for this area. */
  pl_turn_out: number;
  /** Signed diff count (mp_turn_out - pl_turn_out). */
  diff_count: number;
  /** Y axis: winner's votes as % of total area turnout. */
  vote_percent_of_turnout: number;
  /** Bubble size: absolute vote count of the winner. */
  vote_count: number;
  /** Winning candidate name. */
  candidate_name: string;
  /** Winning party name. */
  party_name: string;
  /** Winning party color hex. */
  party_color: string;
}

/** Summary info for one party (for filter pills). */
interface PartyInfo {
  /** Party name. */
  name: string;
  /** Party color hex. */
  color: string;
  /** Number of constituencies won. */
  count: number;
}

// ── Tooltip sub-component ───────────────────

interface BubbleTooltipProps {
  /** Hovered data point. */
  point: BubbleDataPoint;
  /** Mouse position for placement. */
  position: { x: number; y: number };
}

/**
 * BubbleTooltip - Positioned tooltip showing constituency details.
 * Shows actual vote counts for turnout breakdown.
 *
 * @param point - The hovered bubble data.
 * @param position - Current mouse coordinates.
 * @returns Fixed tooltip element.
 */
function BubbleTooltip({ point, position }: BubbleTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("diffwinratio");

  console.log(`[diffwinratio_tooltip] Showing tooltip for ${point.cons_id}`);

  useEffect(() => {
    if (!ref.current) return;
    const tt = ref.current;
    const rect = tt.getBoundingClientRect();
    const margin = 16;
    let x = position.x + margin;
    let y = position.y - margin;
    if (x + rect.width > window.innerWidth - margin) {
      x = position.x - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (y < margin) y = margin;
    tt.style.left = `${x}px`;
    tt.style.top = `${y}px`;
  }, [position]);

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-[100] min-w-[260px] max-w-[360px] rounded-xl border border-border-primary bg-bg-secondary px-4 py-3.5 shadow-[0_8px_32px_var(--shadow-tooltip)]"
    >
      {/* Header: province + constituency */}
      <div className="text-base font-bold text-text-primary">
        {point.prov_name_th} {t("constituency")} {point.cons_no}
      </div>

      <div className="h-px bg-border-primary my-1.5" />

      {/* Party + candidate */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: point.party_color }}
        />
        <span className="text-sm font-semibold text-text-primary">
          {point.party_name}
        </span>
      </div>
      <div className="text-xs text-text-secondary mb-2">
        {point.candidate_name}
      </div>

      <div className="h-px bg-border-primary my-1.5" />

      {/* Winner metrics */}
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("votes")}</span>
        <span className="font-semibold text-text-primary">
          {point.vote_count.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("win_pct")}</span>
        <span className="font-semibold text-text-primary">
          {point.vote_percent_of_turnout.toFixed(1)}%
        </span>
      </div>

      <div className="h-px bg-border-primary my-1.5" />

      {/* Area turnout breakdown — actual counts */}
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("cons_pct")}</span>
        <span className="font-semibold text-text-primary">
          {point.mp_turn_out.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary">{t("pl_pct")}</span>
        <span className="font-semibold text-text-primary">
          {point.pl_turn_out.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between items-center py-0.5 text-sm">
        <span className="text-text-secondary font-medium">{t("diff_pct")}</span>
        <span className="font-bold text-accent">
          {point.diff_count > 0 ? "+" : ""}{point.diff_count.toLocaleString()} ({point.area_diff_pct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

// ── Size legend sub-component ───────────────

interface SizeLegendProps {
  /** Min and max vote counts from data. */
  vote_range: [number, number];
  /** D3 sqrt scale for bubble sizing. */
  size_scale: d3.ScalePower<number, number>;
}

/**
 * SizeLegend - Shows what bubble sizes represent.
 *
 * @param vote_range - [min, max] vote count.
 * @param size_scale - D3 sqrt scale used for bubbles.
 * @returns Legend panel at bottom-left.
 */
function SizeLegend({ vote_range, size_scale }: SizeLegendProps) {
  const t = useTranslations("diffwinratio");

  console.log("[diffwinratio_legend] Rendering size legend");

  const sample_values = [
    vote_range[0],
    Math.round((vote_range[0] + vote_range[1]) / 2),
    vote_range[1],
  ];

  return (
    <div className="absolute bottom-6 left-6 bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 z-50">
      <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider mb-2">
        {t("bubble_size_label")}
      </div>
      <div className="flex items-end gap-3">
        {sample_values.map((val, i) => {
          const r = size_scale(val);
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <svg width={r * 2 + 4} height={r * 2 + 4}>
                <circle
                  cx={r + 2}
                  cy={r + 2}
                  r={r}
                  fill="var(--text-muted)"
                  fillOpacity={0.3}
                  stroke="var(--text-muted)"
                  strokeWidth={1}
                />
              </svg>
              <span className="text-[9px] text-text-muted">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Party filter sub-component ──────────────

interface PartyFilterProps {
  /** All unique parties sorted by seat count. */
  parties: PartyInfo[];
  /** Currently selected party names (empty = show all). */
  selected: Set<string>;
  /** Toggle a party on/off. */
  on_toggle: (party_name: string) => void;
  /** Clear all filters (show all). */
  on_clear: () => void;
}

/**
 * PartyFilter - Scrollable horizontal pill bar for filtering by party.
 *
 * @param parties - List of parties with colors and counts.
 * @param selected - Currently active party filters.
 * @param on_toggle - Callback to toggle a party.
 * @param on_clear - Callback to clear all filters.
 * @returns Floating filter bar element.
 */
function PartyFilter({ parties, selected, on_toggle, on_clear }: PartyFilterProps) {
  console.log(`[diffwinratio_filter] Rendering party filter, ${selected.size} selected`);

  const is_all = selected.size === 0;

  return (
    <div className="absolute top-[7.5rem] left-4 right-4 z-[88]">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {/* "All" pill */}
        <button
          onClick={on_clear}
          className={`shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
            is_all
              ? "bg-accent text-white border-accent"
              : "bg-bg-secondary/90 text-text-muted border-border-primary hover:border-accent backdrop-blur-md"
          }`}
        >
          ทั้งหมด ({parties.reduce((s, p) => s + p.count, 0)})
        </button>

        {/* Party pills */}
        {parties.map((p) => {
          const is_active = selected.has(p.name);
          return (
            <button
              key={p.name}
              onClick={() => on_toggle(p.name)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
                is_active
                  ? "text-white border-transparent"
                  : "bg-bg-secondary/90 text-text-muted border-border-primary hover:border-accent backdrop-blur-md"
              }`}
              style={is_active ? { backgroundColor: p.color, borderColor: p.color } : undefined}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              {p.name} ({p.count})
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main client component ───────────────────

interface DiffWinRatioClientProps {
  /** Enriched constituency GeoJSON features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Election result lookups (winners + diff). */
  election_lookups: ElectionLookups;
}

/**
 * DiffWinRatioClient - Scatter-bubble chart page component.
 *
 * @description Full-screen D3 scatter plot with party-colored bubbles.
 *              X axis: |mp_turn_out − pl_turn_out| (linear scale).
 *              Y axis: winner's votes as % of total turnout.
 *              Bubble size: winner's vote count. Color: party color.
 *              Tooltip shows actual vote counts.
 *              Party filter pills for toggling visibility.
 * @param features - Enriched constituency GeoJSON features.
 * @param election_lookups - Election result lookups.
 * @returns Full-screen scatter-bubble chart with topbar, filter, and legend.
 */
export default function DiffWinRatioClient({
  features,
  election_lookups,
}: DiffWinRatioClientProps) {
  const t = useTranslations("diffwinratio");
  const locale = useLocale();
  const svg_ref = useRef<SVGSVGElement>(null);
  const [hovered, set_hovered] = useState<BubbleDataPoint | null>(null);
  const [tooltip_pos, set_tooltip_pos] = useState({ x: 0, y: 0 });
  const [render_key, set_render_key] = useState(0);
  const [selected_parties, set_selected_parties] = useState<Set<string>>(new Set());

  console.log("[diffwinratio] Rendering scatter-bubble chart");

  /** Track window resize to re-render chart. */
  useEffect(() => {
    const handle_resize = () => set_render_key((k) => k + 1);
    window.addEventListener("resize", handle_resize);
    return () => window.removeEventListener("resize", handle_resize);
  }, []);

  /**
   * Build all data points from features + election lookups.
   *
   * @description X axis = |mp_turn_out − party_list_turn_out| (absolute count).
   *              Y axis = (winner vote_count / area turn_out) * 100.
   *              Uses area-level total turnout diff, not winner-party-only.
   */
  const all_data_points = useMemo(() => {
    console.log("[diffwinratio] Building data points from features");
    const points: BubbleDataPoint[] = [];

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const winner = election_lookups.winners[cons_data.cons_id];
      if (!winner) continue;
      if (winner.turn_out <= 0) continue;

      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) continue;

      const abs_diff = Math.abs(diff.diff_count);

      points.push({
        cons_id: cons_data.cons_id,
        prov_name_th: cons_data.prov_name_th,
        cons_no: cons_data.cons_no,
        area_diff_abs: abs_diff,
        area_diff_pct: Math.abs(diff.diff_percent),
        mp_turn_out: diff.mp_turn_out,
        pl_turn_out: diff.party_list_turn_out,
        diff_count: diff.diff_count,
        vote_percent_of_turnout: (winner.vote_count / winner.turn_out) * 100,
        vote_count: winner.vote_count,
        candidate_name: winner.candidate_name,
        party_name: winner.party_name,
        party_color: winner.party_color,
      });
    }

    console.log(`[diffwinratio] Built ${points.length} data points`);
    return points;
  }, [features, election_lookups]);

  /**
   * Extract unique parties sorted by seat count (descending).
   *
   * @returns Array of PartyInfo sorted by count.
   */
  const parties = useMemo((): PartyInfo[] => {
    const map = new Map<string, PartyInfo>();
    for (const p of all_data_points) {
      const existing = map.get(p.party_name);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.party_name, { name: p.party_name, color: p.party_color, count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [all_data_points]);

  /** Filtered data points based on selected parties. */
  const data_points = useMemo(() => {
    if (selected_parties.size === 0) return all_data_points;
    return all_data_points.filter((d) => selected_parties.has(d.party_name));
  }, [all_data_points, selected_parties]);

  /**
   * Toggle a party in the filter set.
   *
   * @param party_name - Party name to toggle.
   */
  const handle_toggle_party = useCallback((party_name: string) => {
    console.log(`[diffwinratio_filter] Toggle party: ${party_name}`);
    set_selected_parties((prev) => {
      const next = new Set(prev);
      if (next.has(party_name)) {
        next.delete(party_name);
      } else {
        next.add(party_name);
      }
      return next;
    });
  }, []);

  /**
   * Clear all party filters (show all).
   */
  const handle_clear_filter = useCallback(() => {
    console.log("[diffwinratio_filter] Clear all party filters");
    set_selected_parties(new Set());
  }, []);

  /** D3 sqrt scale for bubble sizing (memoized for legend). */
  const size_scale = useMemo(() => {
    if (data_points.length === 0) return d3.scaleSqrt().domain([0, 1]).range([3, 28]);
    const extent = d3.extent(data_points, (d) => d.vote_count) as [number, number];
    return d3.scaleSqrt().domain(extent).range([3, 28]);
  }, [data_points]);

  /** Vote count range for legend. */
  const vote_range = useMemo((): [number, number] => {
    if (data_points.length === 0) return [0, 1];
    return d3.extent(data_points, (d) => d.vote_count) as [number, number];
  }, [data_points]);

  /**
   * D3 chart rendering effect.
   *
   * @description Renders axes, grid, bubbles, and labels into SVG.
   *              X axis uses linear scale. Re-runs on data/filter/resize change.
   */
  useEffect(() => {
    if (!svg_ref.current || data_points.length === 0) return;
    console.log(`[diffwinratio] D3 rendering scatter chart, ${data_points.length} points`);

    const svg = d3.select(svg_ref.current);
    svg.selectAll("*").remove();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = { top: 140, right: 50, bottom: 80, left: 90 };
    const chart_w = width - margin.left - margin.right;
    const chart_h = height - margin.top - margin.bottom;

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Background
    const bg_color = get_css_var("--bg-primary", "#0a0c1a");
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", bg_color);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // ── Scales (linear) ──
    const x_max = d3.max(data_points, (d) => d.area_diff_abs) ?? 1;
    const y_values = data_points.map((d) => d.vote_percent_of_turnout);
    const y_min = d3.min(y_values) ?? 0;
    const y_max = d3.max(y_values) ?? 0;
    const y_pad = (y_max - y_min) * 0.08 || 1;

    const x_scale = d3
      .scaleLinear()
      .domain([0, x_max * 1.05])
      .range([0, chart_w])
      .nice();

    const y_scale = d3
      .scaleLinear()
      .domain([Math.max(0, y_min - y_pad), y_max + y_pad])
      .range([chart_h, 0])
      .nice();

    // ── Theme colors ──
    const text_color = get_css_var("--text-primary", "#e2e8f0");
    const text_muted = get_css_var("--text-muted", "#64748b");
    const grid_color = get_css_var("--border-primary", "#1e293b");
    const accent = get_css_var("--accent", "#f97316");

    // ── Grid lines ──
    g.selectAll(".grid-x")
      .data(x_scale.ticks())
      .join("line")
      .attr("class", "grid-x")
      .attr("x1", (d) => x_scale(d))
      .attr("x2", (d) => x_scale(d))
      .attr("y1", 0)
      .attr("y2", chart_h)
      .attr("stroke", grid_color)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", "2,4");

    g.selectAll(".grid-y")
      .data(y_scale.ticks())
      .join("line")
      .attr("class", "grid-y")
      .attr("x1", 0)
      .attr("x2", chart_w)
      .attr("y1", (d) => y_scale(d))
      .attr("y2", (d) => y_scale(d))
      .attr("stroke", grid_color)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", "2,4");

    // ── Axes ──
    /**
     * Format X axis tick labels as human-readable counts.
     *
     * @param d - Tick value (absolute diff count).
     * @returns Formatted label (e.g. "0", "500", "1k", "5k").
     */
    const format_x_tick = (d: d3.NumberValue): string => {
      const v = d.valueOf();
      if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
      return v.toFixed(0);
    };

    const x_axis = d3
      .axisBottom(x_scale)
      .tickFormat(format_x_tick)
      .tickSize(-6);

    g.append("g")
      .attr("transform", `translate(0,${chart_h})`)
      .call(x_axis)
      .call((sel) => {
        sel
          .selectAll("text")
          .attr("fill", text_muted)
          .style("font-size", "11px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    const y_axis = d3
      .axisLeft(y_scale)
      .tickFormat((d) => `${(d as number).toFixed(0)}%`)
      .tickSize(-6);

    g.append("g")
      .call(y_axis)
      .call((sel) => {
        sel
          .selectAll("text")
          .attr("fill", text_muted)
          .style("font-size", "11px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    // ── Axis labels ──
    g.append("text")
      .attr("x", chart_w / 2)
      .attr("y", chart_h + 55)
      .attr("text-anchor", "middle")
      .attr("fill", text_color)
      .style("font-size", "13px")
      .style("font-weight", "600")
      .text(t("x_axis"));

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chart_h / 2)
      .attr("y", -65)
      .attr("text-anchor", "middle")
      .attr("fill", text_color)
      .style("font-size", "13px")
      .style("font-weight", "600")
      .text(t("y_axis"));

    // ── Bubbles (sorted: largest first so small ones render on top) ──
    const sorted_data = [...data_points].sort(
      (a, b) => b.vote_count - a.vote_count
    );

    g.selectAll(".bubble")
      .data(sorted_data)
      .join("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => x_scale(d.area_diff_abs))
      .attr("cy", (d) => y_scale(d.vote_percent_of_turnout))
      .attr("r", (d) => size_scale(d.vote_count))
      .attr("fill", (d) => d.party_color)
      .attr("fill-opacity", 0.6)
      .attr("stroke", (d) => {
        const c = d3.color(d.party_color);
        return c ? c.darker(0.5).toString() : d.party_color;
      })
      .attr("stroke-width", 1)
      .attr("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d: BubbleDataPoint) {
        d3.select(this)
          .raise()
          .transition()
          .duration(120)
          .attr("fill-opacity", 0.9)
          .attr("stroke-width", 2.5)
          .attr("stroke", accent);
        set_hovered(d);
        set_tooltip_pos({ x: event.clientX, y: event.clientY });
      })
      .on("mousemove", function (event: MouseEvent) {
        set_tooltip_pos({ x: event.clientX, y: event.clientY });
      })
      .on("mouseleave", function (_event: MouseEvent, d: BubbleDataPoint) {
        const c = d3.color(d.party_color);
        d3.select(this)
          .transition()
          .duration(120)
          .attr("fill-opacity", 0.6)
          .attr("stroke-width", 1)
          .attr("stroke", c ? c.darker(0.5).toString() : d.party_color);
        set_hovered(null);
      });

    // ── Labels on larger bubbles (radius > 14px) ──
    const label_threshold = size_scale.invert(14);
    const label_data = sorted_data.filter(
      (d) => d.vote_count >= label_threshold
    );

    g.selectAll(".bubble-label")
      .data(label_data)
      .join("text")
      .attr("class", "bubble-label")
      .attr("x", (d) => x_scale(d.area_diff_abs))
      .attr("y", (d) => y_scale(d.vote_percent_of_turnout))
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .style("font-size", "7px")
      .style("font-weight", "700")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.9)")
      .text((d) => d.party_name);

    console.log(
      `[diffwinratio] Rendered ${sorted_data.length} bubbles, ${label_data.length} labels`
    );
  }, [data_points, size_scale, t, render_key]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* D3 scatter-bubble chart */}
      <svg ref={svg_ref} className="absolute inset-0" />

      {/* TopBar aligned left */}
      <TopBar align="left" />

      {/* Sub-bar: back link + page title */}
      <div className="absolute top-[4.5rem] left-4 z-[89]">
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          {/* Back to map */}
          <a
            href={`/${locale}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer whitespace-nowrap"
          >
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
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </a>

          {/* Page title pill */}
          <span className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-accent whitespace-nowrap">
            {/* Scatter icon */}
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
              <circle cx="7.5" cy="7.5" r="2" />
              <circle cx="16" cy="16" r="3" />
              <circle cx="18" cy="6" r="1.5" />
              <circle cx="5" cy="17" r="1.5" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            {t("title")}
          </span>
        </div>
      </div>

      {/* Party filter bar */}
      <PartyFilter
        parties={parties}
        selected={selected_parties}
        on_toggle={handle_toggle_party}
        on_clear={handle_clear_filter}
      />

      {/* Hover tooltip */}
      {hovered && (
        <BubbleTooltip point={hovered} position={tooltip_pos} />
      )}

      {/* Size legend */}
      <SizeLegend vote_range={vote_range} size_scale={size_scale} />
    </div>
  );
}
