"use client";

/**
 * HeatmapGraphsClient - Interactive visualization dashboard for ballot diff analysis.
 *
 * @description Full-page D3 visualization dashboard showing:
 *   1. Donut pie chart: ผลต่างสะสมรวม by Thai region (6 sectors)
 *   2. Top 10 areas: highest absolute diff with area + winner info (scrollable)
 *   3. Distribution histogram with kernel density overlay (bell curve)
 *   4. Key insights: computed statistics from all 400 constituencies
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import * as d3 from "d3";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ElectionLookups,
} from "@/types/constituency";
import {
  get_css_var,
  PROV_ID_TO_REGION,
  REGION_ORDER,
  REGION_NAMES,
  type RegionKey,
} from "@/lib/constants";
import TopBar from "@/components/topbar";
import WinnerDiffPiechart, { type WinnerDiffItem } from "@/components/winner_diff_piechart";
import RegionNormalizedPiechart, { type RegionNormalizedItem } from "@/components/region_normalized_piechart";
import {
  compute_region_stats,
  group_by_region,
  type RegionDiffStats,
} from "@/components/diff_stats_panel";

// ── Region color palette ───────────────────

/** Visually distinct colors for each Thai region. */
const REGION_COLORS: Record<RegionKey, string> = {
  north: "#22c55e",
  northeast: "#3b82f6",
  central: "#f97316",
  east: "#a855f7",
  west: "#eab308",
  south: "#ef4444",
};

// ── Data types ─────────────────────────────

/** Single area diff item combining diff + winner data. */
interface AreaDiffItem {
  /** ECT constituency ID. */
  cons_id: string;
  /** Thai province name. */
  prov_name_th: string;
  /** Constituency number within province. */
  cons_no: number;
  /** Net turnout diff: MP - party list. */
  diff_count: number;
  /** Percentage turnout diff. */
  diff_percent: number;
  /** Winning candidate name. */
  winner_name: string;
  /** Winning party name. */
  winner_party: string;
  /** Winning party color hex. */
  winner_color: string;
  /** Region this constituency belongs to. */
  region: RegionKey;
}

/** Computed insight statistics from all data. */
interface InsightData {
  /** Σ|diff_count| across all areas. */
  total_abs_diff: number;
  /** Count of areas where diff_count > 0 (more MP voters). */
  positive_count: number;
  /** Count of areas where diff_count < 0 (more party list voters). */
  negative_count: number;
  /** Count of areas where diff_count === 0. */
  zero_count: number;
  /** Total areas with data. */
  total_areas: number;
  /** Arithmetic mean of diff_count (signed). */
  mean_diff: number;
  /** Median of diff_count values. */
  median_diff: number;
  /** Standard deviation of diff_count. */
  std_dev: number;
  /** Region with highest sum_abs_count. */
  highest_region: RegionKey;
  /** The highest region's sum_abs_count value. */
  highest_region_diff: number;
  /** Region with lowest sum_abs_count. */
  lowest_region: RegionKey;
  /** Skewness indicator: > 0 means right-skewed. */
  skewness: number;
  /** Maximum diff_count value. */
  max_diff: number;
  /** Minimum diff_count value. */
  min_diff: number;
}

/** Pie chart sector data for D3. */
interface PieSectorData {
  /** Region key. */
  key: RegionKey;
  /** Thai region name. */
  label: string;
  /** Sum of |diff_count| for this region. */
  value: number;
  /** Sector color. */
  color: string;
}

// ── Kernel density estimation ──────────────

/**
 * Epanechnikov kernel function for density estimation.
 *
 * @param bandwidth - Smoothing bandwidth parameter.
 * @returns Kernel function that returns density weight for a value.
 */
function epanechnikov_kernel(bandwidth: number) {
  return (v: number) => {
    const u = v / bandwidth;
    return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0;
  };
}

/**
 * Compute kernel density estimation for a dataset.
 *
 * @param kernel - Kernel function (e.g. Epanechnikov).
 * @param thresholds - X values at which to estimate density.
 * @param data - Raw data values.
 * @returns Array of [x, density] points.
 */
function compute_kde(
  kernel: (v: number) => number,
  thresholds: number[],
  data: number[]
): [number, number][] {
  return thresholds.map((t) => [
    t,
    d3.mean(data, (d) => kernel(t - d)) ?? 0,
  ]);
}

// ── Component props ────────────────────────

interface HeatmapGraphsClientProps {
  /** Enriched constituency GeoJSON features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Election result lookups (winners, party list, referendum, diff). */
  election_lookups: ElectionLookups;
}

/**
 * HeatmapGraphsClient - Dashboard with pie chart, top 10, bell curve, and insights.
 *
 * @param features - Enriched constituency GeoJSON features.
 * @param election_lookups - Election lookups including diff and winner data.
 * @returns Full-page visualization dashboard.
 */
export default function HeatmapGraphsClient({
  features,
  election_lookups,
}: HeatmapGraphsClientProps) {
  const t = useTranslations("graphs");
  const locale = useLocale();
  const pie_ref = useRef<SVGSVGElement>(null);
  const bell_ref = useRef<SVGSVGElement>(null);
  const bell_container_ref = useRef<HTMLDivElement>(null);
  const [pie_hover, set_pie_hover] = useState<RegionKey | null>(null);
  const [render_key, set_render_key] = useState(0);

  console.log("[heatmap_graphs] Rendering visualization dashboard");

  /** Track window resize to re-render D3 charts. */
  useEffect(() => {
    const handle_resize = () => set_render_key((k) => k + 1);
    window.addEventListener("resize", handle_resize);
    return () => window.removeEventListener("resize", handle_resize);
  }, []);

  // ── Compute all diff items ─────────────────

  /**
   * Build combined diff + winner dataset for all constituencies.
   *
   * @description Joins diff_lookup and winners_lookup by cons_id,
   *              producing AreaDiffItem[] for chart consumption.
   */
  const all_diffs = useMemo(() => {
    console.log("[heatmap_graphs] Computing all_diffs from features");
    const items: AreaDiffItem[] = [];

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) continue;

      const winner = election_lookups.winners[cons_data.cons_id];
      const region = PROV_ID_TO_REGION[cons_data.prov_id] || "central";

      items.push({
        cons_id: cons_data.cons_id,
        prov_name_th: cons_data.prov_name_th,
        cons_no: cons_data.cons_no,
        diff_count: diff.diff_count,
        diff_percent: diff.diff_percent,
        winner_name: winner?.candidate_name || "-",
        winner_party: winner?.party_name || "-",
        winner_color: winner?.party_color || "#666",
        region,
      });
    }

    console.log(`[heatmap_graphs] Built ${items.length} diff items`);
    return items;
  }, [features, election_lookups]);

  // ── Winner Diff Piechart data ───────────────

  /** Map all_diffs to WinnerDiffItem[] for the winner party pie chart (with area info). */
  const winner_diff_items = useMemo((): WinnerDiffItem[] => {
    console.log("[heatmap_graphs] Computing winner diff items");
    return all_diffs.map((d) => ({
      diff_percent: d.diff_percent,
      winner_party: d.winner_party,
      winner_color: d.winner_color,
      prov_name_th: d.prov_name_th,
      cons_no: d.cons_no,
      cons_id: d.cons_id,
    }));
  }, [all_diffs]);

  // ── Normalized Region Piechart data ─────────

  /** Compute per-region sum_abs_diff and total_population for normalized pie. */
  const region_normalized_items = useMemo((): RegionNormalizedItem[] => {
    console.log("[heatmap_graphs] Computing region normalized items");
    const region_data: Record<RegionKey, { sum_abs_diff: number; total_pop: number }> = {
      north: { sum_abs_diff: 0, total_pop: 0 },
      northeast: { sum_abs_diff: 0, total_pop: 0 },
      central: { sum_abs_diff: 0, total_pop: 0 },
      east: { sum_abs_diff: 0, total_pop: 0 },
      west: { sum_abs_diff: 0, total_pop: 0 },
      south: { sum_abs_diff: 0, total_pop: 0 },
    };

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) continue;

      const region = PROV_ID_TO_REGION[cons_data.prov_id] || "central";
      region_data[region].sum_abs_diff += Math.abs(diff.diff_count);
      region_data[region].total_pop += cons_data.registered_voters || 0;
    }

    return REGION_ORDER.map((key) => ({
      key,
      sum_abs_diff: region_data[key].sum_abs_diff,
      total_population: region_data[key].total_pop,
    }));
  }, [features, election_lookups]);

  // ── Top 10 areas ───────────────────────────

  /** Top 10 constituencies sorted by |diff_count| descending. */
  const top10 = useMemo(() => {
    console.log("[heatmap_graphs] Computing top 10 areas");
    return [...all_diffs]
      .sort((a, b) => Math.abs(b.diff_count) - Math.abs(a.diff_count))
      .slice(0, 10);
  }, [all_diffs]);

  // ── Pie chart data ─────────────────────────

  /** Per-region sum_abs_count for donut chart. */
  const pie_data = useMemo(() => {
    console.log("[heatmap_graphs] Computing pie chart data by region");
    const region_sums: Record<RegionKey, number> = {
      north: 0,
      northeast: 0,
      central: 0,
      east: 0,
      west: 0,
      south: 0,
    };

    for (const item of all_diffs) {
      region_sums[item.region] += Math.abs(item.diff_count);
    }

    return REGION_ORDER.map(
      (key): PieSectorData => ({
        key,
        label: REGION_NAMES[key],
        value: region_sums[key],
        color: REGION_COLORS[key],
      })
    );
  }, [all_diffs]);

  // ── Insights ───────────────────────────────

  /** Computed statistical insights from all 400 constituencies. */
  const insights = useMemo((): InsightData => {
    console.log("[heatmap_graphs] Computing insights");
    const diffs = all_diffs.map((d) => d.diff_count);
    const n = diffs.length;

    if (n === 0) {
      return {
        total_abs_diff: 0,
        positive_count: 0,
        negative_count: 0,
        zero_count: 0,
        total_areas: 0,
        mean_diff: 0,
        median_diff: 0,
        std_dev: 0,
        highest_region: "central",
        highest_region_diff: 0,
        lowest_region: "central",
        skewness: 0,
        max_diff: 0,
        min_diff: 0,
      };
    }

    const total_abs_diff = diffs.reduce((s, d) => s + Math.abs(d), 0);
    const positive_count = diffs.filter((d) => d > 0).length;
    const negative_count = diffs.filter((d) => d < 0).length;
    const zero_count = diffs.filter((d) => d === 0).length;
    const mean_diff = d3.mean(diffs) ?? 0;
    const sorted = [...diffs].sort((a, b) => a - b);
    const median_diff = d3.median(sorted) ?? 0;
    const std_dev = d3.deviation(diffs) ?? 0;
    const max_diff = d3.max(diffs) ?? 0;
    const min_diff = d3.min(diffs) ?? 0;

    // Skewness: (mean - median) / std_dev (Pearson's second skewness)
    const skewness = std_dev > 0 ? (3 * (mean_diff - median_diff)) / std_dev : 0;

    // Find region with highest & lowest sum_abs_count
    let highest_region: RegionKey = "central";
    let highest_region_diff = 0;
    let lowest_region: RegionKey = "central";
    let lowest_region_diff = Infinity;

    for (const sector of pie_data) {
      if (sector.value > highest_region_diff) {
        highest_region_diff = sector.value;
        highest_region = sector.key;
      }
      if (sector.value < lowest_region_diff) {
        lowest_region_diff = sector.value;
        lowest_region = sector.key;
      }
    }

    return {
      total_abs_diff,
      positive_count,
      negative_count,
      zero_count,
      total_areas: n,
      mean_diff,
      median_diff,
      std_dev,
      highest_region,
      highest_region_diff,
      lowest_region,
      skewness,
      max_diff,
      min_diff,
    };
  }, [all_diffs, pie_data]);

  // ── D3 Pie Chart Effect ────────────────────

  useEffect(() => {
    if (!pie_ref.current || pie_data.length === 0) return;
    console.log("[heatmap_graphs] D3 rendering pie chart");

    const svg = d3.select(pie_ref.current);
    svg.selectAll("*").remove();

    const size = 360;
    const outer_r = 150;
    const inner_r = 80;

    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);

    const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);

    // Background circle
    const bg_color = get_css_var("--bg-tertiary", "#222640");
    g.append("circle").attr("r", outer_r).attr("fill", bg_color).attr("opacity", 0.3);

    // Pie layout
    const pie_layout = d3
      .pie<PieSectorData>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.02);

    const arc_gen = d3
      .arc<d3.PieArcDatum<PieSectorData>>()
      .innerRadius(inner_r)
      .outerRadius(outer_r)
      .cornerRadius(4);

    const arc_hover = d3
      .arc<d3.PieArcDatum<PieSectorData>>()
      .innerRadius(inner_r - 4)
      .outerRadius(outer_r + 10)
      .cornerRadius(4);

    const arcs = pie_layout(pie_data);

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
        set_pie_hover(d.data.key);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("d", arc_gen as unknown as string)
          .attr("fill-opacity", 0.85);
        set_pie_hover(null);
      });

    // Slice labels (region abbreviation)
    const label_arc = d3
      .arc<d3.PieArcDatum<PieSectorData>>()
      .innerRadius((outer_r + inner_r) / 2)
      .outerRadius((outer_r + inner_r) / 2);

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
        const total = pie_data.reduce((s, p) => s + p.value, 0);
        const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : "0";
        return `${pct}%`;
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
      .text("Σ |diff|");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .attr("fill", accent)
      .style("font-size", "18px")
      .style("font-weight", "800")
      .text(insights.total_abs_diff.toLocaleString());

    console.log("[heatmap_graphs] Pie chart rendered");
  }, [pie_data, insights.total_abs_diff, render_key]);

  // ── D3 Histogram + Density Curve Effect ────

  useEffect(() => {
    if (!bell_ref.current || !bell_container_ref.current || all_diffs.length === 0) return;
    console.log("[heatmap_graphs] D3 rendering bell curve");

    const svg = d3.select(bell_ref.current);
    svg.selectAll("*").remove();

    const container_rect = bell_container_ref.current.getBoundingClientRect();
    const width = Math.max(container_rect.width, 400);
    const height = 320;
    const margin = { top: 30, right: 30, bottom: 55, left: 65 };
    const chart_w = width - margin.left - margin.right;
    const chart_h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    // Background
    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const diffs = all_diffs.map((d) => d.diff_count);
    const x_extent = d3.extent(diffs) as [number, number];
    const x_pad = (x_extent[1] - x_extent[0]) * 0.05 || 100;

    // ── Scales ──
    const x_scale = d3
      .scaleLinear()
      .domain([x_extent[0] - x_pad, x_extent[1] + x_pad])
      .range([0, chart_w])
      .nice();

    // ── Histogram bins ──
    const bin_gen = d3
      .bin()
      .domain(x_scale.domain() as [number, number])
      .thresholds(x_scale.ticks(30));

    const bins = bin_gen(diffs);
    const y_max_hist = d3.max(bins, (b) => b.length) ?? 1;

    const y_scale = d3.scaleLinear().domain([0, y_max_hist * 1.15]).range([chart_h, 0]).nice();

    // ── Theme colors ──
    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");
    const accent = get_css_var("--accent", "#f97316");

    // ── Grid lines ──
    g.selectAll(".grid-y")
      .data(y_scale.ticks(6))
      .join("line")
      .attr("x1", 0)
      .attr("x2", chart_w)
      .attr("y1", (d) => y_scale(d))
      .attr("y2", (d) => y_scale(d))
      .attr("stroke", grid_color)
      .attr("stroke-opacity", 0.35)
      .attr("stroke-dasharray", "2,4");

    // ── Zero reference line ──
    if (x_scale.domain()[0] < 0 && x_scale.domain()[1] > 0) {
      g.append("line")
        .attr("x1", x_scale(0))
        .attr("x2", x_scale(0))
        .attr("y1", 0)
        .attr("y2", chart_h)
        .attr("stroke", accent)
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.6)
        .attr("stroke-dasharray", "6,3");

      g.append("text")
        .attr("x", x_scale(0))
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("fill", accent)
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text("0");
    }

    // ── Histogram bars ──
    g.selectAll(".bar")
      .data(bins)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x_scale(d.x0 ?? 0) + 1)
      .attr("width", (d) => Math.max(0, x_scale(d.x1 ?? 0) - x_scale(d.x0 ?? 0) - 2))
      .attr("y", (d) => y_scale(d.length))
      .attr("height", (d) => chart_h - y_scale(d.length))
      .attr("fill", accent)
      .attr("fill-opacity", 0.35)
      .attr("rx", 2);

    // ── Density curve overlay ──
    const bandwidth = (x_extent[1] - x_extent[0]) / 12 || 100;
    const kde_kernel = epanechnikov_kernel(bandwidth);
    const density_points = compute_kde(kde_kernel, x_scale.ticks(80), diffs);

    // Scale density to match histogram
    const density_max = d3.max(density_points, (d) => d[1]) ?? 1;
    const density_scale_factor = y_max_hist / density_max;

    const density_line = d3
      .line<[number, number]>()
      .x((d) => x_scale(d[0]))
      .y((d) => y_scale(d[1] * density_scale_factor))
      .curve(d3.curveBasis);

    g.append("path")
      .datum(density_points)
      .attr("fill", "none")
      .attr("stroke", accent)
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", 0.9)
      .attr("d", density_line);

    // ── Axes ──
    const x_axis = d3
      .axisBottom(x_scale)
      .tickFormat((d) => (d as number).toLocaleString())
      .tickSize(-4);

    g.append("g")
      .attr("transform", `translate(0,${chart_h})`)
      .call(x_axis)
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    const y_axis = d3.axisLeft(y_scale).ticks(6).tickSize(-4);

    g.append("g")
      .call(y_axis)
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    // ── Axis labels ──
    g.append("text")
      .attr("x", chart_w / 2)
      .attr("y", chart_h + 42)
      .attr("text-anchor", "middle")
      .attr("fill", text_color)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(t("bell_x_label"));

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chart_h / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .attr("fill", text_color)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(t("bell_y_label"));

    // ── Mean + Median annotation lines ──
    const mean_x = x_scale(insights.mean_diff);
    const median_x = x_scale(insights.median_diff);

    // Mean line
    g.append("line")
      .attr("x1", mean_x)
      .attr("x2", mean_x)
      .attr("y1", 0)
      .attr("y2", chart_h)
      .attr("stroke", "#22c55e")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3");

    g.append("text")
      .attr("x", mean_x + 4)
      .attr("y", 12)
      .attr("fill", "#22c55e")
      .style("font-size", "9px")
      .style("font-weight", "600")
      .text(`μ = ${insights.mean_diff.toLocaleString()}`);

    // Median line
    g.append("line")
      .attr("x1", median_x)
      .attr("x2", median_x)
      .attr("y1", 0)
      .attr("y2", chart_h)
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3");

    g.append("text")
      .attr("x", median_x + 4)
      .attr("y", 24)
      .attr("fill", "#3b82f6")
      .style("font-size", "9px")
      .style("font-weight", "600")
      .text(`M = ${insights.median_diff.toLocaleString()}`);

    console.log("[heatmap_graphs] Bell curve rendered");
  }, [all_diffs, insights, t, render_key]);

  // ── Render ─────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Floating topbar */}
      <TopBar />

      {/* Sub-bar: back link + page title */}
      <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-[89]">
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          {/* Back to home */}
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
            {/* Chart bar icon */}
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
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="6" width="4" height="15" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
            {t("title")}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-12">
        {/* Page header */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-10">
          {t("subtitle")}
        </p>

        {/* ── Row 1: Pie Chart + Top 10 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart Card */}
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6">
            <h2 className="text-base font-bold text-text-primary mb-4">{t("pie_title")}</h2>

            <div className="flex flex-col items-center">
              <svg ref={pie_ref} className="w-full max-w-[360px]" />

              {/* Pie legend */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4 w-full">
                {pie_data.map((sector) => {
                  const total = pie_data.reduce((s, p) => s + p.value, 0);
                  const pct = total > 0 ? ((sector.value / total) * 100).toFixed(1) : "0";
                  const is_hovered = pie_hover === sector.key;

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
                          {sector.value.toLocaleString()}{" "}
                          <span className="text-text-muted font-normal">({pct}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top 10 Card */}
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-6 flex flex-col">
            <h2 className="text-base font-bold text-text-primary mb-4">{t("top10_title")}</h2>

            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {top10.map((item, idx) => (
                <div
                  key={item.cons_id}
                  className="flex items-center gap-3 bg-bg-tertiary/50 border border-border-primary rounded-xl px-4 py-3 hover:bg-bg-tertiary transition-colors"
                >
                  {/* Rank */}
                  <div className="text-lg font-extrabold text-text-muted w-7 text-center shrink-0">
                    {idx + 1}
                  </div>

                  {/* Area info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">
                      {item.prov_name_th} {t("constituency")} {item.cons_no}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.winner_color }}
                      />
                      <span className="text-xs text-text-secondary truncate">
                        {item.winner_party} · {item.winner_name}
                      </span>
                    </div>
                  </div>

                  {/* Diff badge */}
                  <div className="text-right shrink-0">
                    <div
                      className="text-sm font-bold"
                      style={{
                        color: item.diff_count > 0 ? "#22c55e" : item.diff_count < 0 ? "#ef4444" : "#6b7280",
                      }}
                    >
                      {item.diff_count > 0 ? "+" : ""}
                      {item.diff_count.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {item.diff_percent > 0 ? "+" : ""}
                      {item.diff_percent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 2: Winner Diff Pie + Normalized Region Pie ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WinnerDiffPiechart items={winner_diff_items} />
          <RegionNormalizedPiechart items={region_normalized_items} />
        </div>

        {/* ── Row 3: Bell Curve ── */}
        <div className="mb-8" ref={bell_container_ref}>
          <h2 className="text-base font-bold text-text-primary mb-4">{t("bell_title")}</h2>
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-2 overflow-hidden">
            <svg ref={bell_ref} className="w-full" />
          </div>
          {/* Legend for mean/median lines */}
          <div className="flex items-center gap-6 mt-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-[#22c55e]" style={{ borderTop: "2px dashed #22c55e" }} />
              <span className="text-xs text-text-secondary">
                {t("insight_mean")} (μ = {insights.mean_diff.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-[#3b82f6]" style={{ borderTop: "2px dashed #3b82f6" }} />
              <span className="text-xs text-text-secondary">
                {t("insight_median")} (M = {insights.median_diff.toLocaleString()})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5" style={{ borderTop: "2px dashed var(--accent)" }} />
              <span className="text-xs text-text-secondary">
                {t("bell_density")}
              </span>
            </div>
          </div>
        </div>

        {/* ── Row 3: Key Insights ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-4">{t("insights_title")}</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Total absolute diff */}
            <InsightCard
              label={t("insight_total_diff")}
              value={insights.total_abs_diff.toLocaleString()}
              color="var(--accent)"
              icon="sigma"
            />

            {/* Positive areas */}
            <InsightCard
              label={t("insight_positive")}
              value={`${insights.positive_count} / ${insights.total_areas}`}
              sub={`${((insights.positive_count / Math.max(insights.total_areas, 1)) * 100).toFixed(1)}%`}
              color="#22c55e"
              icon="up"
            />

            {/* Negative areas */}
            <InsightCard
              label={t("insight_negative")}
              value={`${insights.negative_count} / ${insights.total_areas}`}
              sub={`${((insights.negative_count / Math.max(insights.total_areas, 1)) * 100).toFixed(1)}%`}
              color="#ef4444"
              icon="down"
            />

            {/* Zero areas */}
            <InsightCard
              label={t("insight_zero")}
              value={`${insights.zero_count}`}
              color="#6b7280"
              icon="equal"
            />

            {/* Mean diff */}
            <InsightCard
              label={t("insight_mean")}
              value={`${insights.mean_diff > 0 ? "+" : ""}${insights.mean_diff.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
              color="#22c55e"
              icon="avg"
            />

            {/* Median diff */}
            <InsightCard
              label={t("insight_median")}
              value={`${insights.median_diff > 0 ? "+" : ""}${insights.median_diff.toLocaleString()}`}
              color="#3b82f6"
              icon="median"
            />

            {/* Std dev */}
            <InsightCard
              label={t("insight_std_dev")}
              value={insights.std_dev.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              color="#a855f7"
              icon="spread"
            />

            {/* Highest region */}
            <InsightCard
              label={t("insight_highest_region")}
              value={REGION_NAMES[insights.highest_region]}
              sub={insights.highest_region_diff.toLocaleString()}
              color={REGION_COLORS[insights.highest_region]}
              icon="trophy"
            />

            {/* Max diff */}
            <InsightCard
              label={t("insight_max")}
              value={`+${insights.max_diff.toLocaleString()}`}
              color="#22c55e"
              icon="max"
            />

            {/* Min diff */}
            <InsightCard
              label={t("insight_min")}
              value={insights.min_diff.toLocaleString()}
              color="#ef4444"
              icon="min"
            />

            {/* Skewness */}
            <InsightCard
              label={t("insight_skew")}
              value={insights.skewness.toFixed(3)}
              sub={insights.skewness > 0 ? t("skew_right") : insights.skewness < 0 ? t("skew_left") : t("skew_symmetric")}
              color="#eab308"
              icon="skew"
            />

            {/* Lowest region */}
            <InsightCard
              label={t("insight_lowest_region")}
              value={REGION_NAMES[insights.lowest_region]}
              color={REGION_COLORS[insights.lowest_region]}
              icon="low"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Insight Card Sub-Component ─────────────

interface InsightCardProps {
  /** Card label text. */
  label: string;
  /** Main value to display. */
  value: string;
  /** Optional sub-value (e.g. percentage). */
  sub?: string;
  /** Accent color for the value. */
  color: string;
  /** Icon type identifier. */
  icon: string;
}

/**
 * InsightCard - Single statistic card for the insights grid.
 *
 * @param label - Descriptive label.
 * @param value - Main numeric/text value.
 * @param sub - Optional secondary value.
 * @param color - Accent color for the value.
 * @param icon - Icon type string.
 * @returns Styled insight card element.
 */
function InsightCard({ label, value, sub, color, icon }: InsightCardProps) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 hover:border-border-hover transition-colors">
      <div className="flex items-start gap-2 mb-2">
        <InsightIcon type={icon} color={color} />
        <div className="text-[11px] text-text-muted leading-tight">{label}</div>
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Icon Sub-Component ─────────────────────

/**
 * InsightIcon - Small icon for insight cards.
 *
 * @param type - Icon type identifier.
 * @param color - Icon color.
 * @returns SVG icon element.
 */
function InsightIcon({ type, color }: { type: string; color: string }) {
  const size = 16;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0 mt-0.5",
  };

  switch (type) {
    case "sigma":
      return (
        <svg {...common}>
          <path d="M18 7V4H6v3l6 5-6 5v3h12v-3" />
        </svg>
      );
    case "up":
      return (
        <svg {...common}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case "down":
      return (
        <svg {...common}>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    case "equal":
      return (
        <svg {...common}>
          <line x1="5" y1="9" x2="19" y2="9" />
          <line x1="5" y1="15" x2="19" y2="15" />
        </svg>
      );
    case "avg":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "median":
      return (
        <svg {...common}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <polyline points="8 6 12 2 16 6" />
          <polyline points="8 18 12 22 16 18" />
        </svg>
      );
    case "spread":
      return (
        <svg {...common}>
          <path d="M2 12h4l3-9 6 18 3-9h4" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
          <path d="M18 2H6v7a6 6 0 0012 0V2Z" />
        </svg>
      );
    case "max":
      return (
        <svg {...common}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case "min":
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "skew":
      return (
        <svg {...common}>
          <path d="M3 20Q8 4 21 4" />
        </svg>
      );
    case "low":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
