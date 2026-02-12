"use client";

/**
 * RegionNormalizedPiechart - Donut pie chart showing diff-to-population ratio by region.
 *
 * @description Same visual style as the existing regional pie chart, but each slice
 *              represents Σ|diff_count| / Σ(registered_voters) per region, normalizing
 *              the ballot diff by the total population of each sector.
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as d3 from "d3";
import {
  get_css_var,
  REGION_ORDER,
  REGION_NAMES,
  type RegionKey,
} from "@/lib/constants";

// ── Types ──────────────────────────────────

/** Pre-computed region data needed for this component. */
export interface RegionNormalizedItem {
  /** Region key. */
  key: RegionKey;
  /** Σ|diff_count| for this region. */
  sum_abs_diff: number;
  /** Σ(registered_voters) for this region. */
  total_population: number;
}

/** Internal pie sector data for D3. */
interface NormalizedSectorData {
  /** Region key. */
  key: RegionKey;
  /** Thai region name. */
  label: string;
  /** Normalized ratio: sum_abs_diff / total_population. */
  ratio: number;
  /** Display percentage (ratio × 100). */
  pct: number;
  /** Raw abs diff for tooltip. */
  sum_abs_diff: number;
  /** Raw population for tooltip. */
  total_population: number;
  /** Sector color. */
  color: string;
}

// ── Region color palette (matching main pie) ──

/** Visually distinct colors for each Thai region. */
const REGION_COLORS: Record<RegionKey, string> = {
  north: "#22c55e",
  northeast: "#3b82f6",
  central: "#f97316",
  east: "#a855f7",
  west: "#eab308",
  south: "#ef4444",
};

// ── Component ──────────────────────────────

interface RegionNormalizedPiechartProps {
  /** Pre-computed region data with abs diff and population. */
  items: RegionNormalizedItem[];
}

/**
 * RegionNormalizedPiechart - Donut chart of diff/population ratio by region.
 *
 * @param items - Pre-computed region data with sum_abs_diff and total_population.
 * @returns Card with D3 donut + region legend showing normalized ratios.
 */
export default function RegionNormalizedPiechart({ items }: RegionNormalizedPiechartProps) {
  const t = useTranslations("graphs");
  const svg_ref = useRef<SVGSVGElement>(null);
  const [hovered_region, set_hovered_region] = useState<RegionKey | null>(null);

  console.log("[region_normalized_pie] Rendering normalized pie chart");

  // ── Compute normalized sector data ──────────

  /** Sector data with diff/population ratio per region. */
  const sector_data = useMemo((): NormalizedSectorData[] => {
    console.log("[region_normalized_pie] Computing normalized sector data");

    return REGION_ORDER.map((key) => {
      const item = items.find((i) => i.key === key);
      const sum_abs_diff = item?.sum_abs_diff ?? 0;
      const total_population = item?.total_population ?? 1;
      const ratio = total_population > 0 ? sum_abs_diff / total_population : 0;

      return {
        key,
        label: REGION_NAMES[key],
        ratio,
        pct: ratio * 100,
        sum_abs_diff,
        total_population,
        color: REGION_COLORS[key],
      };
    });
  }, [items]);

  // ── D3 Donut Chart Effect ────────────────────

  useEffect(() => {
    if (!svg_ref.current || sector_data.length === 0) return;
    console.log("[region_normalized_pie] D3 rendering donut chart");

    const svg = d3.select(svg_ref.current);
    svg.selectAll("*").remove();

    const size = 360;
    const outer_r = 150;
    const inner_r = 80;

    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);

    const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);

    // Background circle
    const bg_color = get_css_var("--bg-tertiary", "#222640");
    g.append("circle").attr("r", outer_r).attr("fill", bg_color).attr("opacity", 0.3);

    // Pie layout — use ratio as value
    const pie_layout = d3
      .pie<NormalizedSectorData>()
      .value((d) => d.ratio)
      .sort(null)
      .padAngle(0.02);

    const arc_gen = d3
      .arc<d3.PieArcDatum<NormalizedSectorData>>()
      .innerRadius(inner_r)
      .outerRadius(outer_r)
      .cornerRadius(4);

    const arc_hover = d3
      .arc<d3.PieArcDatum<NormalizedSectorData>>()
      .innerRadius(inner_r - 4)
      .outerRadius(outer_r + 10)
      .cornerRadius(4);

    const arcs = pie_layout(sector_data);

    // Draw slices
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
        set_hovered_region(d.data.key);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc_gen as unknown as string)
          .attr("fill-opacity", 0.85);
        set_hovered_region(null);
      });

    // Slice labels (percentage on large slices)
    const label_arc = d3
      .arc<d3.PieArcDatum<NormalizedSectorData>>()
      .innerRadius((outer_r + inner_r) / 2)
      .outerRadius((outer_r + inner_r) / 2);

    const total_ratio = sector_data.reduce((s, d) => s + d.ratio, 0);

    g.selectAll(".slice-label")
      .data(arcs.filter((d) => d.endAngle - d.startAngle > 0.25))
      .join("text")
      .attr("class", "slice-label")
      .attr("transform", (d) => `translate(${label_arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .style("font-size", "10px")
      .style("font-weight", "700")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)")
      .text((d) => {
        const share = total_ratio > 0 ? ((d.data.ratio / total_ratio) * 100).toFixed(1) : "0";
        return `${share}%`;
      });

    // Center label
    const text_primary = get_css_var("--text-primary", "#e8eaed");
    const accent = get_css_var("--accent", "#f97316");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.3em")
      .attr("fill", text_primary)
      .style("font-size", "11px")
      .style("font-weight", "600")
      .text("Σ|diff| / pop");

    // Overall national ratio
    const total_diff = sector_data.reduce((s, d) => s + d.sum_abs_diff, 0);
    const total_pop = sector_data.reduce((s, d) => s + d.total_population, 0);
    const national_pct = total_pop > 0 ? ((total_diff / total_pop) * 100).toFixed(3) : "0";

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("fill", accent)
      .style("font-size", "18px")
      .style("font-weight", "800")
      .text(`${national_pct}%`);

    console.log("[region_normalized_pie] Donut chart rendered");
  }, [sector_data]);

  // ── Render ─────────────────────────────────

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6">
      <h2 className="text-base font-bold text-text-primary mb-2">{t("normalized_pie_title")}</h2>
      <p className="text-xs text-text-muted mb-4">{t("normalized_pie_desc")}</p>

      <div className="flex flex-col items-center">
        <svg ref={svg_ref} className="w-full max-w-[360px]" />

        {/* Region legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4 w-full">
          {sector_data.map((sector) => {
            const total_ratio_sum = sector_data.reduce((s, d) => s + d.ratio, 0);
            const share = total_ratio_sum > 0
              ? ((sector.ratio / total_ratio_sum) * 100).toFixed(1)
              : "0";
            const is_hovered = hovered_region === sector.key;

            return (
              <div
                key={sector.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  is_hovered ? "bg-bg-tertiary" : ""
                }`}
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: sector.color }}
                />
                <div className="min-w-0">
                  <div className="text-[11px] text-text-secondary truncate">{sector.label}</div>
                  <div className="text-xs font-bold text-text-primary">
                    {sector.pct.toFixed(3)}%{" "}
                    <span className="text-text-muted font-normal">({share}%)</span>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {sector.sum_abs_diff.toLocaleString()} / {sector.total_population.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
