"use client";

/**
 * PartyAnalysisClient - Anomaly detection dashboard by political party.
 *
 * @description Full-page D3 visualization dashboard showing:
 *   1. Horizontal bar chart: total |diff_count| per party in winning constituencies
 *   2. Horizontal bar chart: average diff per constituency per party (diverging)
 *   3. Box plot: diff distribution per party (median, Q1/Q3, whiskers, outliers)
 *   4. Scatter plot: diff_count vs diff_percent per constituency, filtered by party
 *   5. Anomaly table: constituencies with Z-score > 2 grouped by party
 *   6. Party summary statistics table
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import * as d3 from "d3";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ElectionLookups,
} from "@/types/constituency";
import { get_css_var, PROV_ID_TO_REGION } from "@/lib/constants";
import TopBar from "@/components/topbar";

// ── Data types ─────────────────────────────

/** Per-constituency data point joining winner + diff data. */
interface PartyConsItem {
  cons_id: string;
  prov_name_th: string;
  cons_no: number;
  diff_count: number;
  diff_percent: number;
  mp_turn_out: number;
  pl_turn_out: number;
  candidate_name: string;
  party_name: string;
  party_color: string;
  region: string;
}

/** Aggregated party-level statistics. */
interface PartyStats {
  party_name: string;
  party_color: string;
  cons_won: number;
  total_abs_diff: number;
  avg_diff: number;
  avg_abs_diff: number;
  avg_diff_percent: number;
  median_diff: number;
  std_dev: number;
  max_diff: number;
  min_diff: number;
  q1: number;
  q3: number;
  diffs: number[];
  anomaly_count: number;
  anomalies: PartyConsItem[];
}

// ── Component props ────────────────────────

interface PartyAnalysisClientProps {
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  election_lookups: ElectionLookups;
}

/**
 * PartyAnalysisClient - Dashboard with party-level anomaly detection charts.
 *
 * @param features - Enriched constituency GeoJSON features.
 * @param election_lookups - Election lookups including diff and winner data.
 * @returns Full-page party analysis visualization dashboard.
 */
export default function PartyAnalysisClient({
  features,
  election_lookups,
}: PartyAnalysisClientProps) {
  const t = useTranslations("party_analysis");
  const locale = useLocale();
  const bar_total_ref = useRef<SVGSVGElement>(null);
  const bar_avg_ref = useRef<SVGSVGElement>(null);
  const box_ref = useRef<SVGSVGElement>(null);
  const scatter_ref = useRef<SVGSVGElement>(null);
  const scatter_container_ref = useRef<HTMLDivElement>(null);
  const [selected_party, set_selected_party] = useState<string | null>(null);
  const [render_key, set_render_key] = useState(0);

  console.log("[party_analysis] Rendering party analysis dashboard");

  /** Track window resize to re-render D3 charts. */
  useEffect(() => {
    const handle_resize = () => set_render_key((k) => k + 1);
    window.addEventListener("resize", handle_resize);
    return () => window.removeEventListener("resize", handle_resize);
  }, []);

  // ── Build per-constituency dataset ─────────

  const all_items = useMemo(() => {
    console.log("[party_analysis] Computing all_items from features");
    const items: PartyConsItem[] = [];

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const diff = election_lookups.diff[cons_data.cons_id];
      if (!diff) continue;

      const winner = election_lookups.winners[cons_data.cons_id];
      if (!winner) continue;

      const region = PROV_ID_TO_REGION[cons_data.prov_id] || "central";

      items.push({
        cons_id: cons_data.cons_id,
        prov_name_th: cons_data.prov_name_th,
        cons_no: cons_data.cons_no,
        diff_count: diff.diff_count,
        diff_percent: diff.diff_percent,
        mp_turn_out: diff.mp_turn_out,
        pl_turn_out: diff.party_list_turn_out,
        candidate_name: winner.candidate_name,
        party_name: winner.party_name,
        party_color: winner.party_color,
        region,
      });
    }

    console.log(`[party_analysis] Built ${items.length} constituency items`);
    return items;
  }, [features, election_lookups]);

  // ── Global statistics for z-score ──────────

  const global_stats = useMemo(() => {
    const diffs = all_items.map((d) => d.diff_count);
    const mean = d3.mean(diffs) ?? 0;
    const std = d3.deviation(diffs) ?? 1;
    return { mean, std };
  }, [all_items]);

  // ── Aggregate by party ─────────────────────

  const party_stats = useMemo(() => {
    console.log("[party_analysis] Computing party-level stats");
    const groups = new Map<string, PartyConsItem[]>();

    for (const item of all_items) {
      const existing = groups.get(item.party_name) || [];
      existing.push(item);
      groups.set(item.party_name, existing);
    }

    const stats: PartyStats[] = [];

    for (const [party_name, items] of groups) {
      const diffs = items.map((d) => d.diff_count);
      const sorted_diffs = [...diffs].sort((a, b) => a - b);
      const n = diffs.length;

      const total_abs_diff = diffs.reduce((s, d) => s + Math.abs(d), 0);
      const avg_diff = d3.mean(diffs) ?? 0;
      const avg_abs_diff = d3.mean(diffs.map(Math.abs)) ?? 0;
      const avg_diff_percent = d3.mean(items.map((d) => d.diff_percent)) ?? 0;
      const median_diff = d3.median(sorted_diffs) ?? 0;
      const std_dev = d3.deviation(diffs) ?? 0;
      const max_diff = d3.max(diffs) ?? 0;
      const min_diff = d3.min(diffs) ?? 0;
      const q1 = d3.quantile(sorted_diffs, 0.25) ?? 0;
      const q3 = d3.quantile(sorted_diffs, 0.75) ?? 0;

      // Anomalies: constituencies with |z-score| > 2 (using global mean/std)
      const anomalies = items.filter((item) => {
        const z = Math.abs((item.diff_count - global_stats.mean) / global_stats.std);
        return z > 2;
      });

      stats.push({
        party_name,
        party_color: items[0].party_color,
        cons_won: n,
        total_abs_diff,
        avg_diff,
        avg_abs_diff,
        avg_diff_percent,
        median_diff,
        std_dev,
        max_diff,
        min_diff,
        q1,
        q3,
        diffs,
        anomaly_count: anomalies.length,
        anomalies,
      });
    }

    stats.sort((a, b) => b.total_abs_diff - a.total_abs_diff);
    console.log(`[party_analysis] Computed stats for ${stats.length} parties`);
    return stats;
  }, [all_items, global_stats]);

  // ── Unique parties for filter pills ────────

  const party_list = useMemo(() => {
    return party_stats
      .filter((p) => p.cons_won >= 1)
      .map((p) => ({ name: p.party_name, color: p.party_color, count: p.cons_won }));
  }, [party_stats]);

  // ── Filtered items for scatter plot ────────

  const filtered_items = useMemo(() => {
    if (!selected_party) return all_items;
    return all_items.filter((d) => d.party_name === selected_party);
  }, [all_items, selected_party]);

  // ── Major parties (>=3 seats for box plot) ──

  const major_parties = useMemo(() => {
    return party_stats.filter((p) => p.cons_won >= 3);
  }, [party_stats]);

  // ── D3: Total Absolute Diff Bar Chart ──────

  useEffect(() => {
    if (!bar_total_ref.current || party_stats.length === 0) return;
    console.log("[party_analysis] D3 rendering total diff bar chart");

    const svg = d3.select(bar_total_ref.current);
    svg.selectAll("*").remove();

    const data = party_stats.filter((p) => p.cons_won >= 1).slice(0, 15);
    const bar_height = 32;
    const margin = { top: 10, right: 120, bottom: 30, left: 160 };
    const width = 700;
    const height = margin.top + data.length * bar_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const x_scale = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.total_abs_diff) ?? 1])
      .range([0, chart_w]).nice();

    const y_scale = d3.scaleBand()
      .domain(data.map((d) => d.party_name))
      .range([0, data.length * bar_height]).padding(0.25);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");

    // Grid
    g.selectAll(".grid-x").data(x_scale.ticks(5)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", data.length * bar_height)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.3).attr("stroke-dasharray", "2,4");

    // Bars
    g.selectAll(".bar").data(data).join("rect")
      .attr("x", 0).attr("y", (d) => y_scale(d.party_name) ?? 0)
      .attr("width", (d) => x_scale(d.total_abs_diff))
      .attr("height", y_scale.bandwidth())
      .attr("fill", (d) => d.party_color).attr("fill-opacity", 0.8).attr("rx", 4);

    // Value labels
    g.selectAll(".val-label").data(data).join("text")
      .attr("x", (d) => x_scale(d.total_abs_diff) + 6)
      .attr("y", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("fill", text_color)
      .style("font-size", "11px").style("font-weight", "700")
      .text((d) => `${d.total_abs_diff.toLocaleString()} (${d.cons_won})`);

    // Y axis labels
    g.selectAll(".party-label").data(data).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "11px").style("font-weight", "600")
      .text((d) => d.party_name.length > 18 ? d.party_name.slice(0, 18) + "..." : d.party_name);

    // Party color dots
    g.selectAll(".party-dot").data(data).join("circle")
      .attr("cx", -margin.left + 12)
      .attr("cy", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("r", 5).attr("fill", (d) => d.party_color);

    // X axis
    g.append("g").attr("transform", `translate(0,${data.length * bar_height})`)
      .call(d3.axisBottom(x_scale).ticks(5).tickFormat((d) => (d as number).toLocaleString()))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[party_analysis] Total diff bar chart rendered");
  }, [party_stats, render_key]);

  // ── D3: Average Diff Bar Chart ─────────────

  useEffect(() => {
    if (!bar_avg_ref.current || party_stats.length === 0) return;
    console.log("[party_analysis] D3 rendering avg diff bar chart");

    const svg = d3.select(bar_avg_ref.current);
    svg.selectAll("*").remove();

    const sorted = [...party_stats.filter((p) => p.cons_won >= 1).slice(0, 15)]
      .sort((a, b) => b.avg_abs_diff - a.avg_abs_diff);

    const bar_height = 32;
    const margin = { top: 10, right: 100, bottom: 30, left: 160 };
    const width = 700;
    const height = margin.top + sorted.length * bar_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const max_abs = d3.max(sorted, (d) => Math.abs(d.avg_diff)) ?? 1;
    const x_scale = d3.scaleLinear().domain([-max_abs * 1.1, max_abs * 1.1]).range([0, chart_w]).nice();

    const y_scale = d3.scaleBand()
      .domain(sorted.map((d) => d.party_name))
      .range([0, sorted.length * bar_height]).padding(0.25);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");
    const zero_x = x_scale(0);

    // Zero line
    g.append("line").attr("x1", zero_x).attr("x2", zero_x)
      .attr("y1", 0).attr("y2", sorted.length * bar_height)
      .attr("stroke", get_css_var("--accent", "#f97316"))
      .attr("stroke-width", 1.5).attr("stroke-opacity", 0.6).attr("stroke-dasharray", "4,3");

    // Grid
    g.selectAll(".grid-x").data(x_scale.ticks(6)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", sorted.length * bar_height)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");

    // Bars (diverging from zero)
    g.selectAll(".bar").data(sorted).join("rect")
      .attr("x", (d) => d.avg_diff >= 0 ? zero_x : x_scale(d.avg_diff))
      .attr("y", (d) => y_scale(d.party_name) ?? 0)
      .attr("width", (d) => Math.abs(x_scale(d.avg_diff) - zero_x))
      .attr("height", y_scale.bandwidth())
      .attr("fill", (d) => d.avg_diff >= 0 ? "#22c55e" : "#ef4444")
      .attr("fill-opacity", 0.7).attr("rx", 3);

    // Value labels
    g.selectAll(".val-label").data(sorted).join("text")
      .attr("x", (d) => d.avg_diff >= 0 ? x_scale(d.avg_diff) + 6 : x_scale(d.avg_diff) - 6)
      .attr("y", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.avg_diff >= 0 ? "start" : "end")
      .attr("fill", text_color).style("font-size", "10px").style("font-weight", "600")
      .text((d) => `${d.avg_diff > 0 ? "+" : ""}${d.avg_diff.toFixed(1)}`);

    // Y axis labels
    g.selectAll(".party-label").data(sorted).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "11px").style("font-weight", "600")
      .text((d) => d.party_name.length > 18 ? d.party_name.slice(0, 18) + "..." : d.party_name);

    // Party color dots
    g.selectAll(".party-dot").data(sorted).join("circle")
      .attr("cx", -margin.left + 12)
      .attr("cy", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("r", 5).attr("fill", (d) => d.party_color);

    // X axis
    g.append("g").attr("transform", `translate(0,${sorted.length * bar_height})`)
      .call(d3.axisBottom(x_scale).ticks(6).tickFormat((d) => (d as number).toLocaleString()))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[party_analysis] Avg diff bar chart rendered");
  }, [party_stats, render_key]);

  // ── D3: Box Plot ───────────────────────────

  useEffect(() => {
    if (!box_ref.current || major_parties.length === 0) return;
    console.log("[party_analysis] D3 rendering box plot");

    const svg = d3.select(box_ref.current);
    svg.selectAll("*").remove();

    const data = major_parties.slice(0, 12);
    const row_height = 48;
    const margin = { top: 20, right: 30, bottom: 40, left: 160 };
    const width = 700;
    const height = margin.top + data.length * row_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const all_diffs = data.flatMap((d) => d.diffs);
    const x_extent = d3.extent(all_diffs) as [number, number];
    const x_pad = (x_extent[1] - x_extent[0]) * 0.1 || 100;
    const x_scale = d3.scaleLinear().domain([x_extent[0] - x_pad, x_extent[1] + x_pad]).range([0, chart_w]).nice();

    const y_scale = d3.scaleBand()
      .domain(data.map((d) => d.party_name))
      .range([0, data.length * row_height]).padding(0.3);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");

    // Zero reference
    if (x_scale.domain()[0] < 0 && x_scale.domain()[1] > 0) {
      g.append("line").attr("x1", x_scale(0)).attr("x2", x_scale(0))
        .attr("y1", 0).attr("y2", data.length * row_height)
        .attr("stroke", get_css_var("--accent", "#f97316"))
        .attr("stroke-width", 1).attr("stroke-opacity", 0.5).attr("stroke-dasharray", "4,3");
    }

    // Grid
    g.selectAll(".grid-x").data(x_scale.ticks(8)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", data.length * row_height)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.2).attr("stroke-dasharray", "2,4");

    // Draw box plots per party
    for (const party of data) {
      const cy = (y_scale(party.party_name) ?? 0) + y_scale.bandwidth() / 2;
      const box_h = y_scale.bandwidth() * 0.6;
      const iqr = party.q3 - party.q1;
      const whisker_lo = Math.max(party.min_diff, party.q1 - 1.5 * iqr);
      const whisker_hi = Math.min(party.max_diff, party.q3 + 1.5 * iqr);

      // Whisker line
      g.append("line")
        .attr("x1", x_scale(whisker_lo)).attr("x2", x_scale(whisker_hi))
        .attr("y1", cy).attr("y2", cy)
        .attr("stroke", party.party_color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.6);

      // Whisker caps
      for (const wx of [whisker_lo, whisker_hi]) {
        g.append("line")
          .attr("x1", x_scale(wx)).attr("x2", x_scale(wx))
          .attr("y1", cy - box_h / 3).attr("y2", cy + box_h / 3)
          .attr("stroke", party.party_color).attr("stroke-width", 1.5).attr("stroke-opacity", 0.6);
      }

      // IQR box
      g.append("rect")
        .attr("x", x_scale(party.q1)).attr("y", cy - box_h / 2)
        .attr("width", Math.max(0, x_scale(party.q3) - x_scale(party.q1)))
        .attr("height", box_h)
        .attr("fill", party.party_color).attr("fill-opacity", 0.3)
        .attr("stroke", party.party_color).attr("stroke-width", 1.5).attr("rx", 3);

      // Median line
      g.append("line")
        .attr("x1", x_scale(party.median_diff)).attr("x2", x_scale(party.median_diff))
        .attr("y1", cy - box_h / 2).attr("y2", cy + box_h / 2)
        .attr("stroke", "#fff").attr("stroke-width", 2);

      // Outlier dots
      const outliers = party.diffs.filter((d) => d < whisker_lo || d > whisker_hi);
      g.selectAll(null).data(outliers).join("circle")
        .attr("cx", (d) => x_scale(d)).attr("cy", cy).attr("r", 3)
        .attr("fill", party.party_color).attr("fill-opacity", 0.6)
        .attr("stroke", party.party_color).attr("stroke-width", 0.5);
    }

    // Y axis labels
    g.selectAll(".party-label").data(data).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "11px").style("font-weight", "600")
      .text((d) => d.party_name.length > 18 ? d.party_name.slice(0, 18) + "..." : d.party_name);

    // Party color dots
    g.selectAll(".party-dot").data(data).join("circle")
      .attr("cx", -margin.left + 12)
      .attr("cy", (d) => (y_scale(d.party_name) ?? 0) + y_scale.bandwidth() / 2)
      .attr("r", 5).attr("fill", (d) => d.party_color);

    // X axis
    g.append("g").attr("transform", `translate(0,${data.length * row_height})`)
      .call(d3.axisBottom(x_scale).ticks(8).tickFormat((d) => (d as number).toLocaleString()))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[party_analysis] Box plot rendered");
  }, [major_parties, render_key]);

  // ── D3: Scatter Plot ───────────────────────

  useEffect(() => {
    if (!scatter_ref.current || !scatter_container_ref.current || filtered_items.length === 0) return;
    console.log("[party_analysis] D3 rendering scatter plot");

    const svg = d3.select(scatter_ref.current);
    svg.selectAll("*").remove();

    const container_rect = scatter_container_ref.current.getBoundingClientRect();
    const width = Math.max(container_rect.width, 400);
    const height = 420;
    const margin = { top: 20, right: 30, bottom: 55, left: 65 };
    const chart_w = width - margin.left - margin.right;
    const chart_h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");

    const x_extent = d3.extent(filtered_items, (d) => d.diff_count) as [number, number];
    const y_extent = d3.extent(filtered_items, (d) => d.diff_percent) as [number, number];
    const x_pad = (x_extent[1] - x_extent[0]) * 0.08 || 50;
    const y_pad = (y_extent[1] - y_extent[0]) * 0.08 || 0.5;

    const x_scale = d3.scaleLinear().domain([x_extent[0] - x_pad, x_extent[1] + x_pad]).range([0, chart_w]).nice();
    const y_scale = d3.scaleLinear().domain([y_extent[0] - y_pad, y_extent[1] + y_pad]).range([chart_h, 0]).nice();

    // Grid
    g.selectAll(".grid-y").data(y_scale.ticks(6)).join("line")
      .attr("x1", 0).attr("x2", chart_w)
      .attr("y1", (d) => y_scale(d)).attr("y2", (d) => y_scale(d))
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");
    g.selectAll(".grid-x").data(x_scale.ticks(6)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", chart_h)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");

    // Zero reference lines
    if (x_scale.domain()[0] < 0 && x_scale.domain()[1] > 0) {
      g.append("line").attr("x1", x_scale(0)).attr("x2", x_scale(0))
        .attr("y1", 0).attr("y2", chart_h)
        .attr("stroke", get_css_var("--accent", "#f97316"))
        .attr("stroke-width", 1).attr("stroke-opacity", 0.4).attr("stroke-dasharray", "4,3");
    }
    if (y_scale.domain()[0] < 0 && y_scale.domain()[1] > 0) {
      g.append("line").attr("x1", 0).attr("x2", chart_w)
        .attr("y1", y_scale(0)).attr("y2", y_scale(0))
        .attr("stroke", get_css_var("--accent", "#f97316"))
        .attr("stroke-width", 1).attr("stroke-opacity", 0.4).attr("stroke-dasharray", "4,3");
    }

    // Normal zone (+-2 std dev)
    const lo_2std = global_stats.mean - 2 * global_stats.std;
    const hi_2std = global_stats.mean + 2 * global_stats.std;
    const x_lo = Math.max(x_scale.domain()[0], lo_2std);
    const x_hi = Math.min(x_scale.domain()[1], hi_2std);

    g.append("rect")
      .attr("x", x_scale(x_lo)).attr("y", 0)
      .attr("width", x_scale(x_hi) - x_scale(x_lo)).attr("height", chart_h)
      .attr("fill", "#22c55e").attr("fill-opacity", 0.04);

    g.append("text")
      .attr("x", x_scale((x_lo + x_hi) / 2)).attr("y", 12)
      .attr("text-anchor", "middle").attr("fill", "#22c55e").attr("fill-opacity", 0.5)
      .style("font-size", "9px").text(t("scatter_normal_zone"));

    // Tooltip div
    const tooltip_el = scatter_container_ref.current.querySelector(".scatter-tooltip") as HTMLDivElement;

    // Dots
    g.selectAll(".dot").data(filtered_items).join("circle")
      .attr("cx", (d) => x_scale(d.diff_count))
      .attr("cy", (d) => y_scale(d.diff_percent))
      .attr("r", (d) => {
        const z = Math.abs((d.diff_count - global_stats.mean) / global_stats.std);
        return z > 2 ? 6 : 4;
      })
      .attr("fill", (d) => d.party_color)
      .attr("fill-opacity", (d) => {
        const z = Math.abs((d.diff_count - global_stats.mean) / global_stats.std);
        return z > 2 ? 0.95 : 0.55;
      })
      .attr("stroke", (d) => {
        const z = Math.abs((d.diff_count - global_stats.mean) / global_stats.std);
        return z > 2 ? "#fff" : d.party_color;
      })
      .attr("stroke-width", (d) => {
        const z = Math.abs((d.diff_count - global_stats.mean) / global_stats.std);
        return z > 2 ? 1.5 : 0.5;
      })
      .attr("cursor", "pointer")
      .on("mouseenter", function (_event, d) {
        d3.select(this).attr("r", 8).attr("fill-opacity", 1);
        if (tooltip_el) {
          const z = ((d.diff_count - global_stats.mean) / global_stats.std).toFixed(2);
          tooltip_el.style.display = "block";
          tooltip_el.innerHTML =
            `<div style="font-weight:700;margin-bottom:3px">${d.prov_name_th} ${t("constituency")} ${d.cons_no}</div>` +
            `<div style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.party_color}"></span>${d.party_name} · ${d.candidate_name}</div>` +
            `<div style="margin-top:4px">diff: <b>${d.diff_count > 0 ? "+" : ""}${d.diff_count.toLocaleString()}</b> (${d.diff_percent > 0 ? "+" : ""}${d.diff_percent.toFixed(2)}%)</div>` +
            `<div>z-score: <b style="color:${Math.abs(Number(z)) > 2 ? "#ef4444" : "#22c55e"}">${z}</b></div>`;
        }
      })
      .on("mousemove", function (event) {
        if (tooltip_el) {
          const [mx, my] = d3.pointer(event, scatter_container_ref.current);
          tooltip_el.style.left = `${mx + 16}px`;
          tooltip_el.style.top = `${my - 10}px`;
        }
      })
      .on("mouseleave", function (_event, d) {
        const z_val = Math.abs((d.diff_count - global_stats.mean) / global_stats.std);
        d3.select(this).attr("r", z_val > 2 ? 6 : 4).attr("fill-opacity", z_val > 2 ? 0.95 : 0.55);
        if (tooltip_el) tooltip_el.style.display = "none";
      });

    // Axes
    g.append("g").attr("transform", `translate(0,${chart_h})`)
      .call(d3.axisBottom(x_scale).tickFormat((d) => (d as number).toLocaleString()).tickSize(-4))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });
    g.append("g")
      .call(d3.axisLeft(y_scale).ticks(6).tickSize(-4))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    // Axis labels
    g.append("text").attr("x", chart_w / 2).attr("y", chart_h + 42)
      .attr("text-anchor", "middle").attr("fill", text_color)
      .style("font-size", "12px").style("font-weight", "600").text(t("scatter_x_label"));
    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -chart_h / 2).attr("y", -48)
      .attr("text-anchor", "middle").attr("fill", text_color)
      .style("font-size", "12px").style("font-weight", "600").text(t("scatter_y_label"));

    console.log("[party_analysis] Scatter plot rendered");
  }, [filtered_items, global_stats, t, render_key]);

  // ── Handle party filter click ──────────────

  const handle_party_click = useCallback((party_name: string) => {
    console.log(`[party_analysis] Filter toggled: ${party_name}`);
    set_selected_party((prev) => (prev === party_name ? null : party_name));
  }, []);

  // ── Render ─────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary">
      <TopBar />

      {/* Sub-bar */}
      <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-[89]">
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          <a href={`/${locale}`} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-accent whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            {t("title")}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-12">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6 sm:mb-10">{t("subtitle")}</p>

        {/* Section 1: Total Absolute Diff by Party */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("total_diff_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("total_diff_desc")}</p>
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={bar_total_ref} className="w-full" />
          </div>
        </div>

        {/* Section 2: Average Diff by Party */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("avg_diff_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("avg_diff_desc")}</p>
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={bar_avg_ref} className="w-full" />
          </div>
          <div className="flex items-center gap-6 mt-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#22c55e] opacity-70" />
              <span className="text-xs text-text-secondary">{t("legend_mp_higher")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#ef4444] opacity-70" />
              <span className="text-xs text-text-secondary">{t("legend_pl_higher")}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Box Plot */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("box_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("box_desc")}</p>
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={box_ref} className="w-full" />
          </div>
          <div className="flex items-center gap-6 mt-3 px-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded-sm border-2 border-text-muted bg-text-muted/20" />
              <span className="text-xs text-text-secondary">{t("box_legend_iqr")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-white" />
              <span className="text-xs text-text-secondary">{t("box_legend_median")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-text-muted" />
              <span className="text-xs text-text-secondary">{t("box_legend_outlier")}</span>
            </div>
          </div>
        </div>

        {/* Section 4: Scatter Plot with Party Filter */}
        <div className="mb-8" ref={scatter_container_ref}>
          <h2 className="text-base font-bold text-text-primary mb-2">{t("scatter_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("scatter_desc")}</p>

          {/* Party filter pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => set_selected_party(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                selected_party === null
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-bg-secondary border-border-primary text-text-secondary hover:border-border-hover"
              }`}
            >
              {t("filter_all")} ({all_items.length})
            </button>
            {party_list.map((p) => (
              <button
                key={p.name}
                onClick={() => handle_party_click(p.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  selected_party === p.name
                    ? "border-white/40 text-text-primary"
                    : "bg-bg-secondary border-border-primary text-text-secondary hover:border-border-hover"
                }`}
                style={selected_party === p.name ? { backgroundColor: p.color + "33", borderColor: p.color } : {}}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                {p.name} ({p.count})
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="bg-bg-secondary border border-border-primary rounded-2xl p-2 overflow-hidden">
              <svg ref={scatter_ref} className="w-full" />
            </div>
            <div className="scatter-tooltip absolute pointer-events-none bg-bg-primary/95 border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary shadow-lg z-50" style={{ display: "none" }} />
          </div>

          <div className="flex items-center gap-6 mt-3 px-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-text-muted/50 border border-text-muted" />
              <span className="text-xs text-text-secondary">{t("scatter_legend_normal")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 border-2 border-white" />
              <span className="text-xs text-text-secondary">{t("scatter_legend_anomaly")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded bg-[#22c55e]/10 border border-[#22c55e]/30" />
              <span className="text-xs text-text-secondary">{t("scatter_normal_zone")}</span>
            </div>
          </div>
        </div>

        {/* Section 5: Anomaly Table */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("anomaly_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("anomaly_desc")}</p>

          {/* Party anomaly summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {party_stats.filter((p) => p.anomaly_count > 0).map((p) => (
              <div key={p.party_name}
                className="bg-bg-secondary border border-border-primary rounded-xl p-4 hover:border-border-hover transition-colors cursor-pointer"
                onClick={() => handle_party_click(p.party_name)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.party_color }} />
                  <span className="text-[11px] text-text-muted truncate">{p.party_name}</span>
                </div>
                <div className="text-xl font-bold text-red-400">
                  {p.anomaly_count}
                  <span className="text-xs font-normal text-text-muted ml-1">/ {p.cons_won} {t("constituency")}</span>
                </div>
                <div className="text-[10px] text-text-secondary mt-1">
                  {t("anomaly_rate")}: {((p.anomaly_count / p.cons_won) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* Detailed anomaly table */}
          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/50">
                    <th className="text-left px-4 py-3 text-text-muted font-semibold">{t("table_party")}</th>
                    <th className="text-left px-4 py-3 text-text-muted font-semibold">{t("table_area")}</th>
                    <th className="text-left px-4 py-3 text-text-muted font-semibold">{t("table_candidate")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("table_diff_count")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("table_diff_pct")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">Z-Score</th>
                  </tr>
                </thead>
                <tbody>
                  {party_stats
                    .flatMap((p) => p.anomalies.map((a) => ({
                      ...a, z_score: (a.diff_count - global_stats.mean) / global_stats.std,
                    })))
                    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score))
                    .slice(0, 50)
                    .map((item, idx) => (
                      <tr key={`${item.cons_id}-${idx}`}
                        className="border-b border-border-primary/50 hover:bg-bg-tertiary/30 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.party_color }} />
                            <span className="text-text-primary font-medium truncate max-w-[120px]">{item.party_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-primary">{item.prov_name_th} {t("constituency")} {item.cons_no}</td>
                        <td className="px-4 py-2.5 text-text-secondary truncate max-w-[120px]">{item.candidate_name}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: item.diff_count > 0 ? "#22c55e" : "#ef4444" }}>
                          {item.diff_count > 0 ? "+" : ""}{item.diff_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">
                          {item.diff_percent > 0 ? "+" : ""}{item.diff_percent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-400">
                          {item.z_score > 0 ? "+" : ""}{item.z_score.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 6: Party Summary Stats Table */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("summary_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("summary_desc")}</p>

          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/50">
                    <th className="text-left px-4 py-3 text-text-muted font-semibold">{t("table_party")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_seats")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_total_diff")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_avg_diff")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_avg_pct")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_std_dev")}</th>
                    <th className="text-right px-4 py-3 text-text-muted font-semibold">{t("summary_anomalies")}</th>
                  </tr>
                </thead>
                <tbody>
                  {party_stats.filter((p) => p.cons_won >= 1).map((p) => (
                    <tr key={p.party_name}
                      className="border-b border-border-primary/50 hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
                      onClick={() => handle_party_click(p.party_name)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.party_color }} />
                          <span className="text-text-primary font-semibold">{p.party_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-primary font-medium">{p.cons_won}</td>
                      <td className="px-4 py-2.5 text-right font-bold" style={{ color: "var(--accent)" }}>{p.total_abs_diff.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: p.avg_diff > 0 ? "#22c55e" : "#ef4444" }}>
                        {p.avg_diff > 0 ? "+" : ""}{p.avg_diff.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">
                        {p.avg_diff_percent > 0 ? "+" : ""}{p.avg_diff_percent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-secondary">{p.std_dev.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {p.anomaly_count > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">{p.anomaly_count}</span>
                        ) : (
                          <span className="text-text-muted">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
