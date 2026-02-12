"use client";

/**
 * WinnerDiffPiechart - Interactive donut pie chart showing winning party distribution
 * in constituencies where |diff_percent| exceeds a user-editable threshold.
 *
 * @description Filters all 400 constituencies by |diff_percent| > threshold,
 *              groups remaining winners by party, and renders a D3 donut chart
 *              with party colors. User can adjust the threshold via slider + input.
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import * as d3 from "d3";
import { get_css_var } from "@/lib/constants";

// ── Types ──────────────────────────────────

/** Constituency data needed for this component (with optional area info for hover list). */
export interface WinnerDiffItem {
  /** Percentage turnout diff (MP - party list). */
  diff_percent: number;
  /** Winning party name. */
  winner_party: string;
  /** Winning party color hex. */
  winner_color: string;
  /** Thai province name (for hover area list). */
  prov_name_th?: string;
  /** Constituency number within province (for hover area list). */
  cons_no?: number;
  /** ECT constituency ID (for hover area list). */
  cons_id?: string;
}

/** Area info for hover tooltip list. */
interface AreaInfo {
  /** Thai province name. */
  prov_name_th: string;
  /** Constituency number. */
  cons_no: number;
  /** Absolute diff percent. */
  abs_diff_percent: number;
}

/** Internal party slice data for D3 pie. */
interface PartySlice {
  /** Party name. */
  party: string;
  /** Number of winning MPs in filtered set. */
  count: number;
  /** Party color hex. */
  color: string;
  /** Matching areas for this party (for hover tooltip). */
  areas: AreaInfo[];
}

// ── Config ─────────────────────────────────

/** Default threshold percentage. */
const DEFAULT_THRESHOLD = 2.5;
/** Minimum threshold value. */
const MIN_THRESHOLD = 0;
/** Maximum threshold value. */
const MAX_THRESHOLD = 15;
/** Slider step increment. */
const STEP = 0.1;

// ── Component ──────────────────────────────

interface WinnerDiffPiechartProps {
  /** All constituency items with diff + winner data. */
  items: WinnerDiffItem[];
}

/**
 * WinnerDiffPiechart - Donut chart of winning parties in high-diff areas.
 *
 * @param items - All constituency diff items with winner data.
 * @returns Card with threshold controls + D3 donut + party legend.
 */
export default function WinnerDiffPiechart({ items }: WinnerDiffPiechartProps) {
  const t = useTranslations("graphs");
  const svg_ref = useRef<SVGSVGElement>(null);
  const [threshold, set_threshold] = useState(DEFAULT_THRESHOLD);
  const [hovered_party, set_hovered_party] = useState<string | null>(null);

  console.log("[winner_diff_pie] Rendering with threshold:", threshold);

  // ── Filter + Group by party ────────────────

  /** Constituencies passing the threshold filter. */
  const filtered = useMemo(
    () => items.filter((i) => Math.abs(i.diff_percent) > threshold),
    [items, threshold]
  );

  /** Party-level aggregation sorted by count desc, with area details. */
  const party_slices = useMemo((): PartySlice[] => {
    console.log(`[winner_diff_pie] Filtering: ${filtered.length}/${items.length} areas above ${threshold}%`);
    const map = new Map<string, { count: number; color: string; areas: AreaInfo[] }>();

    for (const item of filtered) {
      const area_info: AreaInfo | null =
        item.prov_name_th && item.cons_no
          ? { prov_name_th: item.prov_name_th, cons_no: item.cons_no, abs_diff_percent: Math.abs(item.diff_percent) }
          : null;

      const existing = map.get(item.winner_party);
      if (existing) {
        existing.count++;
        if (area_info) existing.areas.push(area_info);
      } else {
        map.set(item.winner_party, {
          count: 1,
          color: item.winner_color,
          areas: area_info ? [area_info] : [],
        });
      }
    }

    return [...map.entries()]
      .map(([party, { count, color, areas }]) => ({
        party,
        count,
        color,
        areas: areas.sort((a, b) => b.abs_diff_percent - a.abs_diff_percent),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, items.length, threshold]);

  /**
   * Handle threshold change from slider or input.
   *
   * @param val - New threshold value as string.
   */
  const handle_threshold_change = useCallback((val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= MIN_THRESHOLD && num <= MAX_THRESHOLD) {
      set_threshold(Math.round(num * 10) / 10);
    }
  }, []);

  // ── D3 Pie Chart Effect ────────────────────

  useEffect(() => {
    if (!svg_ref.current) return;
    console.log("[winner_diff_pie] D3 rendering donut chart");

    const svg = d3.select(svg_ref.current);
    svg.selectAll("*").remove();

    const size = 340;
    const outer_r = 140;
    const inner_r = 75;

    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);

    const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);

    // Background
    const bg_color = get_css_var("--bg-tertiary", "#222640");
    g.append("circle").attr("r", outer_r).attr("fill", bg_color).attr("opacity", 0.3);

    if (party_slices.length === 0) {
      // Empty state
      const text_muted = get_css_var("--text-muted", "#6b7280");
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", text_muted)
        .style("font-size", "13px")
        .text(t("winner_pie_empty"));
      return;
    }

    // Pie layout
    const pie_layout = d3
      .pie<PartySlice>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.02);

    const arc_gen = d3
      .arc<d3.PieArcDatum<PartySlice>>()
      .innerRadius(inner_r)
      .outerRadius(outer_r)
      .cornerRadius(3);

    const arc_hover = d3
      .arc<d3.PieArcDatum<PartySlice>>()
      .innerRadius(inner_r - 3)
      .outerRadius(outer_r + 8)
      .cornerRadius(3);

    const arcs = pie_layout(party_slices);

    // Slices
    g.selectAll(".slice")
      .data(arcs)
      .join("path")
      .attr("class", "slice")
      .attr("d", arc_gen)
      .attr("fill", (d) => d.data.color)
      .attr("fill-opacity", 0.85)
      .attr("stroke", get_css_var("--bg-primary", "#0f1117"))
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("mouseenter", function (_event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc_hover as unknown as string)
          .attr("fill-opacity", 1);
        set_hovered_party(d.data.party);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc_gen as unknown as string)
          .attr("fill-opacity", 0.85);
        set_hovered_party(null);
      });

    // Slice labels (% on large slices)
    const label_arc = d3
      .arc<d3.PieArcDatum<PartySlice>>()
      .innerRadius((outer_r + inner_r) / 2)
      .outerRadius((outer_r + inner_r) / 2);

    g.selectAll(".slice-label")
      .data(arcs.filter((d) => d.endAngle - d.startAngle > 0.3))
      .join("text")
      .attr("class", "slice-label")
      .attr("transform", (d) => `translate(${label_arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .style("font-size", "9px")
      .style("font-weight", "700")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
      .text((d) => {
        const pct = ((d.data.count / filtered.length) * 100).toFixed(1);
        return `${pct}%`;
      });

    // Center label
    const text_primary = get_css_var("--text-primary", "#e8eaed");
    const accent = get_css_var("--accent", "#f97316");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.5em")
      .attr("fill", text_primary)
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text(`|diff| > ${threshold}%`);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .attr("fill", accent)
      .style("font-size", "20px")
      .style("font-weight", "800")
      .text(`${filtered.length}`);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "2.5em")
      .attr("fill", get_css_var("--text-muted", "#6b7280"))
      .style("font-size", "10px")
      .text(`/ ${items.length} ${t("winner_pie_areas")}`);

    console.log(`[winner_diff_pie] Rendered ${party_slices.length} party slices`);
  }, [party_slices, filtered.length, items.length, threshold, t]);

  // ── Render ─────────────────────────────────

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6">
      <h2 className="text-base font-bold text-text-primary mb-2">{t("winner_pie_title")}</h2>
      <p className="text-xs text-text-muted mb-4">{t("winner_pie_desc")}</p>

      {/* Threshold controls */}
      <div className="flex items-center gap-3 mb-4 bg-bg-tertiary/50 rounded-xl px-4 py-3">
        <label className="text-xs text-text-secondary whitespace-nowrap shrink-0">
          {t("winner_pie_threshold")}
        </label>
        <input
          type="range"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          step={STEP}
          value={threshold}
          onChange={(e) => handle_threshold_change(e.target.value)}
          className="flex-1 h-1.5 bg-border-primary rounded-full appearance-none cursor-pointer accent-accent"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            step={STEP}
            value={threshold}
            onChange={(e) => handle_threshold_change(e.target.value)}
            className="w-16 bg-bg-primary border border-border-primary rounded-lg px-2 py-1 text-sm text-text-primary text-center font-mono focus:outline-none focus:border-accent"
          />
          <span className="text-xs text-text-muted">%</span>
        </div>
      </div>

      {/* Pie chart */}
      <div className="flex flex-col items-center">
        <svg ref={svg_ref} className="w-full max-w-[340px]" />

        {/* Party legend (scrollable if many parties) */}
        <div className="w-full mt-4 max-h-[200px] overflow-y-auto space-y-1 pr-1">
          {party_slices.map((slice) => {
            const pct = filtered.length > 0
              ? ((slice.count / filtered.length) * 100).toFixed(1)
              : "0";
            const is_hovered = hovered_party === slice.party;

            return (
              <div
                key={slice.party}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  is_hovered ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/50"
                }`}
                onMouseEnter={() => set_hovered_party(slice.party)}
                onMouseLeave={() => set_hovered_party(null)}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-xs text-text-secondary flex-1 truncate">{slice.party}</span>
                <span className="text-xs font-bold text-text-primary">{slice.count}</span>
                <span className="text-[10px] text-text-muted">({pct}%)</span>
              </div>
            );
          })}
        </div>

        {/* Hover area list — shows matching constituencies for hovered party */}
        {hovered_party && (() => {
          const hovered_slice = party_slices.find((s) => s.party === hovered_party);
          if (!hovered_slice || hovered_slice.areas.length === 0) return null;

          return (
            <div className="w-full mt-3 bg-bg-tertiary/70 border border-border-primary rounded-xl p-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: hovered_slice.color }}
                />
                <span className="text-xs font-semibold text-text-primary truncate">
                  {hovered_party}
                </span>
                <span className="text-[10px] text-text-muted ml-auto">
                  {hovered_slice.areas.length} {t("winner_pie_areas")}
                </span>
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-0.5 pr-1">
                {hovered_slice.areas.map((area, idx) => (
                  <div
                    key={`${area.prov_name_th}-${area.cons_no}-${idx}`}
                    className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-bg-secondary/60 text-xs"
                  >
                    <span className="text-text-secondary truncate">
                      {area.prov_name_th} {t("winner_pie_areas")} {area.cons_no}
                    </span>
                    <span className="text-text-muted font-mono shrink-0 ml-2">
                      {area.abs_diff_percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
