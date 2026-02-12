"use client";

/**
 * BallotForensicsClient - Forensic analysis of ballot invalid/blank/valid votes.
 *
 * @description Full-page dashboard exposing previously hidden ECT data:
 *   1. Overview Cards: headline forensic metrics
 *   2. Invalid Vote Scatter: MP invalid % vs PL invalid % per constituency
 *   3. Invalid & Blank Diff Bar Chart: top 30 by diff
 *   4. Reporting Completeness: stations counted progress
 *   5. Referendum Cross-Reference: election vs referendum turnout
 *   6. Composite Anomaly Score: weighted multi-factor anomaly ranking
 *   7. Interactive Drilldown Table: all 400 constituencies, sortable & filterable
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

/** Per-constituency forensic data point. */
interface ForensicsItem {
  cons_id: string;
  prov_name_th: string;
  cons_no: number;
  party_name: string;
  party_color: string;
  candidate_name: string;
  region: string;
  // Invalid
  mp_invalid_pct: number;
  pl_invalid_pct: number;
  invalid_diff: number;
  // Blank
  mp_blank_pct: number;
  pl_blank_pct: number;
  blank_diff: number;
  // Turnout diff
  turnout_diff_pct: number;
  // Referendum
  referendum_turnout_pct: number;
  election_turnout_pct: number;
  // Completeness
  percent_count: number;
  pause_report: boolean;
  counted_vote_stations: number;
  total_vote_stations: number;
  // Registered
  registered_voters: number;
  mp_turnout_of_registered: number;
  // Valid
  mp_valid_pct: number;
  pl_valid_pct: number;
  // Raw vote counts
  mp_invalid_votes: number;
  pl_invalid_votes: number;
  mp_blank_votes: number;
  pl_blank_votes: number;
  // Anomaly score (computed later)
  anomaly_score: number;
}

// ── Component props ────────────────────────

interface BallotForensicsClientProps {
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  election_lookups: ElectionLookups;
}

/** Sort direction for table columns. */
type SortDir = "asc" | "desc";

/**
 * BallotForensicsClient - Interactive forensics dashboard.
 *
 * @param features - Enriched constituency GeoJSON features.
 * @param election_lookups - Election lookups including forensics data.
 * @returns Full-page forensics visualization dashboard.
 */
export default function BallotForensicsClient({
  features,
  election_lookups,
}: BallotForensicsClientProps) {
  const t = useTranslations("ballot_forensics");
  const locale = useLocale();
  const scatter_invalid_ref = useRef<SVGSVGElement>(null);
  const scatter_invalid_container_ref = useRef<HTMLDivElement>(null);
  const bar_diff_ref = useRef<SVGSVGElement>(null);
  const bar_completeness_ref = useRef<SVGSVGElement>(null);
  const scatter_ref_ref = useRef<SVGSVGElement>(null);
  const scatter_ref_container_ref = useRef<HTMLDivElement>(null);
  const bar_anomaly_ref = useRef<SVGSVGElement>(null);
  const [render_key, set_render_key] = useState(0);
  const [sort_col, set_sort_col] = useState<string>("anomaly_score");
  const [sort_dir, set_sort_dir] = useState<SortDir>("desc");
  const [selected_party, set_selected_party] = useState<string | null>(null);
  const [diff_mode, set_diff_mode] = useState<"invalid" | "blank">("invalid");

  console.log("[ballot_forensics] Rendering forensics dashboard");

  /** Track window resize to re-render D3 charts. */
  useEffect(() => {
    /**
     * Handle window resize by incrementing render key.
     */
    const handle_resize = () => set_render_key((k) => k + 1);
    window.addEventListener("resize", handle_resize);
    return () => window.removeEventListener("resize", handle_resize);
  }, []);

  // ── Build per-constituency dataset ─────────

  const all_items = useMemo(() => {
    console.log("[ballot_forensics] Computing all_items from features");
    const items: ForensicsItem[] = [];

    for (const f of features) {
      const cons_data = f.properties._cons_data;
      if (!cons_data) continue;

      const forensics = election_lookups.forensics[cons_data.cons_id];
      if (!forensics) continue;

      const winner = election_lookups.winners[cons_data.cons_id];
      const diff = election_lookups.diff[cons_data.cons_id];
      const referendum = election_lookups.referendum[cons_data.cons_id];
      const region = PROV_ID_TO_REGION[cons_data.prov_id] || "central";

      // Referendum turnout: use percent_turn_out from referendum data
      // We derive it from the ConsReferendumData (yes+no+abstain should approximate 100%)
      // Since we don't have raw referendum turnout %, use diff data for election turnout
      const election_turnout_pct = diff?.mp_percent_turn_out ?? 0;
      // Referendum turnout approximate from forensics registered voters
      const ref_data = election_lookups.referendum[cons_data.cons_id];

      items.push({
        cons_id: cons_data.cons_id,
        prov_name_th: cons_data.prov_name_th,
        cons_no: cons_data.cons_no,
        party_name: winner?.party_name ?? "N/A",
        party_color: winner?.party_color ?? "#666",
        candidate_name: winner?.candidate_name ?? "N/A",
        region,
        mp_invalid_pct: forensics.mp_invalid_pct,
        pl_invalid_pct: forensics.pl_invalid_pct,
        invalid_diff: forensics.invalid_diff,
        mp_blank_pct: forensics.mp_blank_pct,
        pl_blank_pct: forensics.pl_blank_pct,
        blank_diff: forensics.blank_diff,
        turnout_diff_pct: diff?.diff_percent ?? 0,
        referendum_turnout_pct: ref_data ? 100 - (ref_data.percent_abstained ?? 0) : 0,
        election_turnout_pct,
        percent_count: forensics.percent_count,
        pause_report: forensics.pause_report,
        counted_vote_stations: forensics.counted_vote_stations,
        total_vote_stations: forensics.total_vote_stations,
        registered_voters: forensics.registered_voters,
        mp_turnout_of_registered: forensics.mp_turnout_of_registered,
        mp_valid_pct: forensics.mp_valid_pct,
        pl_valid_pct: forensics.pl_valid_pct,
        mp_invalid_votes: forensics.mp_invalid_votes,
        pl_invalid_votes: forensics.pl_invalid_votes,
        mp_blank_votes: forensics.mp_blank_votes,
        pl_blank_votes: forensics.pl_blank_votes,
        anomaly_score: 0, // computed below
      });
    }

    // Compute composite anomaly score
    const max_invalid = d3.max(items, (d) => Math.abs(d.invalid_diff)) || 1;
    const max_blank = d3.max(items, (d) => Math.abs(d.blank_diff)) || 1;
    const max_turnout = d3.max(items, (d) => Math.abs(d.turnout_diff_pct)) || 1;
    const max_ref_gap = d3.max(items, (d) => Math.abs(d.election_turnout_pct - d.referendum_turnout_pct)) || 1;

    for (const item of items) {
      const invalid_component = (Math.abs(item.invalid_diff) / max_invalid) * 0.3;
      const blank_component = (Math.abs(item.blank_diff) / max_blank) * 0.2;
      const turnout_component = (Math.abs(item.turnout_diff_pct) / max_turnout) * 0.25;
      const ref_gap = Math.abs(item.election_turnout_pct - item.referendum_turnout_pct);
      const ref_component = (ref_gap / max_ref_gap) * 0.15;
      const completeness_penalty = item.percent_count < 100 ? 0.1 : 0;

      item.anomaly_score = (invalid_component + blank_component + turnout_component + ref_component + completeness_penalty) * 100;
    }

    console.log(`[ballot_forensics] Built ${items.length} forensics items`);
    return items;
  }, [features, election_lookups]);

  // ── Unique parties for filter ──────────────

  const party_list = useMemo(() => {
    const counts = new Map<string, { color: string; count: number }>();
    for (const item of all_items) {
      const existing = counts.get(item.party_name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(item.party_name, { color: item.party_color, count: 1 });
      }
    }
    return [...counts.entries()]
      .map(([name, info]) => ({ name, color: info.color, count: info.count }))
      .sort((a, b) => b.count - a.count);
  }, [all_items]);

  // ── Filtered items ─────────────────────────

  const filtered_items = useMemo(() => {
    if (!selected_party) return all_items;
    return all_items.filter((d) => d.party_name === selected_party);
  }, [all_items, selected_party]);

  // ── Overview metrics ───────────────────────

  const overview = useMemo(() => {
    console.log("[ballot_forensics] Computing overview metrics");
    const total_mp_invalid = all_items.reduce((s, d) => s + d.mp_invalid_votes, 0);
    const total_pl_invalid = all_items.reduce((s, d) => s + d.pl_invalid_votes, 0);
    const total_mp_blank = all_items.reduce((s, d) => s + d.mp_blank_votes, 0);
    const total_pl_blank = all_items.reduce((s, d) => s + d.pl_blank_votes, 0);
    const avg_invalid_diff = d3.mean(all_items, (d) => d.invalid_diff) ?? 0;
    const paused_count = all_items.filter((d) => d.pause_report).length;
    const incomplete_count = all_items.filter((d) => d.percent_count < 100).length;
    const avg_ref_gap = d3.mean(all_items, (d) => Math.abs(d.election_turnout_pct - d.referendum_turnout_pct)) ?? 0;

    return {
      total_mp_invalid,
      total_pl_invalid,
      invalid_diff: total_mp_invalid - total_pl_invalid,
      total_mp_blank,
      total_pl_blank,
      blank_diff: total_mp_blank - total_pl_blank,
      avg_invalid_diff,
      paused_count,
      incomplete_count,
      avg_ref_gap,
    };
  }, [all_items]);

  // ── D3: Invalid Vote Scatter Plot ──────────

  useEffect(() => {
    if (!scatter_invalid_ref.current || !scatter_invalid_container_ref.current || filtered_items.length === 0) return;
    console.log("[ballot_forensics] D3 rendering invalid vote scatter");

    const svg = d3.select(scatter_invalid_ref.current);
    svg.selectAll("*").remove();

    const container_rect = scatter_invalid_container_ref.current.getBoundingClientRect();
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

    const max_invalid = d3.max(filtered_items, (d) => Math.max(d.mp_invalid_pct, d.pl_invalid_pct)) ?? 5;
    const domain_max = Math.max(max_invalid * 1.1, 1);

    const x_scale = d3.scaleLinear().domain([0, domain_max]).range([0, chart_w]).nice();
    const y_scale = d3.scaleLinear().domain([0, domain_max]).range([chart_h, 0]).nice();

    // Grid
    g.selectAll(".grid-y").data(y_scale.ticks(6)).join("line")
      .attr("x1", 0).attr("x2", chart_w)
      .attr("y1", (d) => y_scale(d)).attr("y2", (d) => y_scale(d))
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");
    g.selectAll(".grid-x").data(x_scale.ticks(6)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", chart_h)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");

    // Diagonal reference line (y = x)
    const diag_max = Math.min(x_scale.domain()[1], y_scale.domain()[1]);
    g.append("line")
      .attr("x1", x_scale(0)).attr("y1", y_scale(0))
      .attr("x2", x_scale(diag_max)).attr("y2", y_scale(diag_max))
      .attr("stroke", get_css_var("--accent", "#f97316"))
      .attr("stroke-width", 1.5).attr("stroke-opacity", 0.5).attr("stroke-dasharray", "6,4");

    g.append("text")
      .attr("x", x_scale(diag_max * 0.7)).attr("y", y_scale(diag_max * 0.7) - 8)
      .attr("fill", get_css_var("--accent", "#f97316")).attr("fill-opacity", 0.6)
      .style("font-size", "9px").text(t("scatter_diagonal"));

    // Tooltip div
    const tooltip_el = scatter_invalid_container_ref.current.querySelector(".scatter-tooltip") as HTMLDivElement;

    // Dots
    g.selectAll(".dot").data(filtered_items).join("circle")
      .attr("cx", (d) => x_scale(d.mp_invalid_pct))
      .attr("cy", (d) => y_scale(d.pl_invalid_pct))
      .attr("r", (d) => {
        const dist = Math.abs(d.mp_invalid_pct - d.pl_invalid_pct);
        return dist > 1 ? 6 : 4;
      })
      .attr("fill", (d) => d.party_color)
      .attr("fill-opacity", (d) => {
        const dist = Math.abs(d.mp_invalid_pct - d.pl_invalid_pct);
        return dist > 1 ? 0.9 : 0.5;
      })
      .attr("stroke", (d) => {
        const dist = Math.abs(d.mp_invalid_pct - d.pl_invalid_pct);
        return dist > 1 ? "#fff" : d.party_color;
      })
      .attr("stroke-width", (d) => {
        const dist = Math.abs(d.mp_invalid_pct - d.pl_invalid_pct);
        return dist > 1 ? 1.5 : 0.5;
      })
      .attr("cursor", "pointer")
      .on("mouseenter", function (_event, d) {
        d3.select(this).attr("r", 8).attr("fill-opacity", 1);
        if (tooltip_el) {
          tooltip_el.style.display = "block";
          tooltip_el.innerHTML =
            `<div style="font-weight:700;margin-bottom:3px">${d.prov_name_th} ${t("constituency")} ${d.cons_no}</div>` +
            `<div style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.party_color}"></span>${d.party_name}</div>` +
            `<div style="margin-top:4px">${t("mp_invalid")}: <b>${d.mp_invalid_pct.toFixed(2)}%</b></div>` +
            `<div>${t("pl_invalid")}: <b>${d.pl_invalid_pct.toFixed(2)}%</b></div>` +
            `<div>${t("diff")}: <b style="color:${d.invalid_diff > 0 ? "#22c55e" : "#ef4444"}">${d.invalid_diff > 0 ? "+" : ""}${d.invalid_diff.toFixed(2)}%</b></div>`;
        }
      })
      .on("mousemove", function (event) {
        if (tooltip_el) {
          const [mx, my] = d3.pointer(event, scatter_invalid_container_ref.current);
          tooltip_el.style.left = `${mx + 16}px`;
          tooltip_el.style.top = `${my - 10}px`;
        }
      })
      .on("mouseleave", function (_event, d) {
        const dist = Math.abs(d.mp_invalid_pct - d.pl_invalid_pct);
        d3.select(this).attr("r", dist > 1 ? 6 : 4).attr("fill-opacity", dist > 1 ? 0.9 : 0.5);
        if (tooltip_el) tooltip_el.style.display = "none";
      });

    // Axes
    g.append("g").attr("transform", `translate(0,${chart_h})`)
      .call(d3.axisBottom(x_scale).ticks(6).tickFormat((d) => `${d}%`).tickSize(-4))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });
    g.append("g")
      .call(d3.axisLeft(y_scale).ticks(6).tickFormat((d) => `${d}%`).tickSize(-4))
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

    console.log("[ballot_forensics] Invalid vote scatter rendered");
  }, [filtered_items, t, render_key]);

  // ── D3: Invalid/Blank Diff Bar Chart ───────

  useEffect(() => {
    if (!bar_diff_ref.current || all_items.length === 0) return;
    console.log("[ballot_forensics] D3 rendering diff bar chart");

    const svg = d3.select(bar_diff_ref.current);
    svg.selectAll("*").remove();

    const sorted = [...all_items]
      .sort((a, b) => {
        const key = diff_mode === "invalid" ? "invalid_diff" : "blank_diff";
        return Math.abs(b[key]) - Math.abs(a[key]);
      })
      .slice(0, 30);

    const bar_height = 28;
    const margin = { top: 10, right: 80, bottom: 30, left: 150 };
    const width = 700;
    const height = margin.top + sorted.length * bar_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const key = diff_mode === "invalid" ? "invalid_diff" : "blank_diff";
    const max_abs = d3.max(sorted, (d) => Math.abs(d[key])) ?? 1;
    const x_scale = d3.scaleLinear().domain([-max_abs * 1.1, max_abs * 1.1]).range([0, chart_w]).nice();

    const y_scale = d3.scaleBand()
      .domain(sorted.map((d) => `${d.prov_name_th} ${d.cons_no}`))
      .range([0, sorted.length * bar_height]).padding(0.2);

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
      .attr("stroke", grid_color).attr("stroke-opacity", 0.2).attr("stroke-dasharray", "2,4");

    // Bars
    g.selectAll(".bar").data(sorted).join("rect")
      .attr("x", (d) => d[key] >= 0 ? zero_x : x_scale(d[key]))
      .attr("y", (d) => y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0)
      .attr("width", (d) => Math.abs(x_scale(d[key]) - zero_x))
      .attr("height", y_scale.bandwidth())
      .attr("fill", (d) => d[key] >= 0 ? "#22c55e" : "#ef4444")
      .attr("fill-opacity", 0.7).attr("rx", 3);

    // Party color dots
    g.selectAll(".party-dot").data(sorted).join("circle")
      .attr("cx", -margin.left + 12)
      .attr("cy", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("r", 4).attr("fill", (d) => d.party_color);

    // Labels
    g.selectAll(".area-label").data(sorted).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "10px").style("font-weight", "500")
      .text((d) => {
        const label = `${d.prov_name_th} ${d.cons_no}`;
        return label.length > 16 ? label.slice(0, 16) + "..." : label;
      });

    // Value labels
    g.selectAll(".val-label").data(sorted).join("text")
      .attr("x", (d) => d[key] >= 0 ? x_scale(d[key]) + 4 : x_scale(d[key]) - 4)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d[key] >= 0 ? "start" : "end")
      .attr("fill", text_color).style("font-size", "9px").style("font-weight", "600")
      .text((d) => `${d[key] > 0 ? "+" : ""}${d[key].toFixed(2)}%`);

    // X axis
    g.append("g").attr("transform", `translate(0,${sorted.length * bar_height})`)
      .call(d3.axisBottom(x_scale).ticks(6).tickFormat((d) => `${d}%`))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[ballot_forensics] Diff bar chart rendered");
  }, [all_items, diff_mode, render_key]);

  // ── D3: Reporting Completeness Bar Chart ───

  useEffect(() => {
    if (!bar_completeness_ref.current || all_items.length === 0) return;
    console.log("[ballot_forensics] D3 rendering completeness bar chart");

    const svg = d3.select(bar_completeness_ref.current);
    svg.selectAll("*").remove();

    const incomplete = [...all_items]
      .filter((d) => d.percent_count < 100 || d.pause_report)
      .sort((a, b) => a.percent_count - b.percent_count)
      .slice(0, 30);

    if (incomplete.length === 0) {
      const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
      svg.attr("width", "100%").attr("height", 80).attr("viewBox", "0 0 700 80");
      svg.append("rect").attr("width", 700).attr("height", 80).attr("fill", bg_color).attr("rx", 12);
      svg.append("text").attr("x", 350).attr("y", 45)
        .attr("text-anchor", "middle").attr("fill", get_css_var("--text-muted", "#6b7280"))
        .style("font-size", "13px").text(t("all_complete"));
      return;
    }

    const bar_height = 28;
    const margin = { top: 10, right: 80, bottom: 30, left: 150 };
    const width = 700;
    const height = margin.top + incomplete.length * bar_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const x_scale = d3.scaleLinear().domain([0, 100]).range([0, chart_w]);

    const y_scale = d3.scaleBand()
      .domain(incomplete.map((d) => `${d.prov_name_th} ${d.cons_no}`))
      .range([0, incomplete.length * bar_height]).padding(0.2);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");

    // Background bars (100%)
    g.selectAll(".bg-bar").data(incomplete).join("rect")
      .attr("x", 0).attr("y", (d) => y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0)
      .attr("width", chart_w).attr("height", y_scale.bandwidth())
      .attr("fill", grid_color).attr("fill-opacity", 0.3).attr("rx", 3);

    // Progress bars
    g.selectAll(".progress-bar").data(incomplete).join("rect")
      .attr("x", 0).attr("y", (d) => y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0)
      .attr("width", (d) => x_scale(d.percent_count))
      .attr("height", y_scale.bandwidth())
      .attr("fill", (d) => d.pause_report ? "#ef4444" : "#f97316")
      .attr("fill-opacity", 0.7).attr("rx", 3);

    // Labels
    g.selectAll(".area-label").data(incomplete).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "10px").style("font-weight", "500")
      .text((d) => {
        const label = `${d.prov_name_th} ${d.cons_no}`;
        return label.length > 16 ? label.slice(0, 16) + "..." : label;
      });

    // Value labels
    g.selectAll(".val-label").data(incomplete).join("text")
      .attr("x", (d) => x_scale(d.percent_count) + 6)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("fill", text_color)
      .style("font-size", "9px").style("font-weight", "700")
      .text((d) => `${d.counted_vote_stations}/${d.total_vote_stations} (${d.percent_count.toFixed(1)}%)${d.pause_report ? " ⏸" : ""}`);

    // X axis
    g.append("g").attr("transform", `translate(0,${incomplete.length * bar_height})`)
      .call(d3.axisBottom(x_scale).ticks(5).tickFormat((d) => `${d}%`))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[ballot_forensics] Completeness bar chart rendered");
  }, [all_items, t, render_key]);

  // ── D3: Referendum Cross-Reference Scatter ──

  useEffect(() => {
    if (!scatter_ref_ref.current || !scatter_ref_container_ref.current || filtered_items.length === 0) return;
    console.log("[ballot_forensics] D3 rendering referendum scatter");

    const svg = d3.select(scatter_ref_ref.current);
    svg.selectAll("*").remove();

    const items_with_ref = filtered_items.filter((d) => d.referendum_turnout_pct > 0);
    if (items_with_ref.length === 0) return;

    const container_rect = scatter_ref_container_ref.current.getBoundingClientRect();
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

    const extent_all = [...items_with_ref.map((d) => d.election_turnout_pct), ...items_with_ref.map((d) => d.referendum_turnout_pct)];
    const min_val = (d3.min(extent_all) ?? 50) - 2;
    const max_val = (d3.max(extent_all) ?? 100) + 2;

    const x_scale = d3.scaleLinear().domain([min_val, max_val]).range([0, chart_w]).nice();
    const y_scale = d3.scaleLinear().domain([min_val, max_val]).range([chart_h, 0]).nice();

    // Grid
    g.selectAll(".grid-y").data(y_scale.ticks(6)).join("line")
      .attr("x1", 0).attr("x2", chart_w)
      .attr("y1", (d) => y_scale(d)).attr("y2", (d) => y_scale(d))
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");
    g.selectAll(".grid-x").data(x_scale.ticks(6)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", chart_h)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.25).attr("stroke-dasharray", "2,4");

    // Diagonal
    const diag_min = Math.max(x_scale.domain()[0], y_scale.domain()[0]);
    const diag_max_val = Math.min(x_scale.domain()[1], y_scale.domain()[1]);
    g.append("line")
      .attr("x1", x_scale(diag_min)).attr("y1", y_scale(diag_min))
      .attr("x2", x_scale(diag_max_val)).attr("y2", y_scale(diag_max_val))
      .attr("stroke", get_css_var("--accent", "#f97316"))
      .attr("stroke-width", 1.5).attr("stroke-opacity", 0.5).attr("stroke-dasharray", "6,4");

    // Tooltip
    const tooltip_el = scatter_ref_container_ref.current.querySelector(".scatter-tooltip") as HTMLDivElement;

    // Dots
    g.selectAll(".dot").data(items_with_ref).join("circle")
      .attr("cx", (d) => x_scale(d.election_turnout_pct))
      .attr("cy", (d) => y_scale(d.referendum_turnout_pct))
      .attr("r", 4)
      .attr("fill", (d) => d.party_color)
      .attr("fill-opacity", 0.6)
      .attr("stroke", (d) => d.party_color)
      .attr("stroke-width", 0.5)
      .attr("cursor", "pointer")
      .on("mouseenter", function (_event, d) {
        d3.select(this).attr("r", 7).attr("fill-opacity", 1);
        if (tooltip_el) {
          const gap = (d.election_turnout_pct - d.referendum_turnout_pct).toFixed(2);
          tooltip_el.style.display = "block";
          tooltip_el.innerHTML =
            `<div style="font-weight:700;margin-bottom:3px">${d.prov_name_th} ${t("constituency")} ${d.cons_no}</div>` +
            `<div style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.party_color}"></span>${d.party_name}</div>` +
            `<div style="margin-top:4px">${t("election_turnout")}: <b>${d.election_turnout_pct.toFixed(2)}%</b></div>` +
            `<div>${t("ref_turnout")}: <b>${d.referendum_turnout_pct.toFixed(2)}%</b></div>` +
            `<div>${t("gap")}: <b>${gap}%</b></div>`;
        }
      })
      .on("mousemove", function (event) {
        if (tooltip_el) {
          const [mx, my] = d3.pointer(event, scatter_ref_container_ref.current);
          tooltip_el.style.left = `${mx + 16}px`;
          tooltip_el.style.top = `${my - 10}px`;
        }
      })
      .on("mouseleave", function () {
        d3.select(this).attr("r", 4).attr("fill-opacity", 0.6);
        if (tooltip_el) tooltip_el.style.display = "none";
      });

    // Axes
    g.append("g").attr("transform", `translate(0,${chart_h})`)
      .call(d3.axisBottom(x_scale).ticks(6).tickFormat((d) => `${d}%`).tickSize(-4))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });
    g.append("g")
      .call(d3.axisLeft(y_scale).ticks(6).tickFormat((d) => `${d}%`).tickSize(-4))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    // Axis labels
    g.append("text").attr("x", chart_w / 2).attr("y", chart_h + 42)
      .attr("text-anchor", "middle").attr("fill", text_color)
      .style("font-size", "12px").style("font-weight", "600").text(t("ref_scatter_x"));
    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -chart_h / 2).attr("y", -48)
      .attr("text-anchor", "middle").attr("fill", text_color)
      .style("font-size", "12px").style("font-weight", "600").text(t("ref_scatter_y"));

    console.log("[ballot_forensics] Referendum scatter rendered");
  }, [filtered_items, t, render_key]);

  // ── D3: Composite Anomaly Score Bar Chart ──

  useEffect(() => {
    if (!bar_anomaly_ref.current || all_items.length === 0) return;
    console.log("[ballot_forensics] D3 rendering anomaly score chart");

    const svg = d3.select(bar_anomaly_ref.current);
    svg.selectAll("*").remove();

    const sorted = [...all_items].sort((a, b) => b.anomaly_score - a.anomaly_score).slice(0, 50);

    const bar_height = 24;
    const margin = { top: 10, right: 80, bottom: 30, left: 150 };
    const width = 700;
    const height = margin.top + sorted.length * bar_height + margin.bottom;

    svg.attr("width", "100%").attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const bg_color = get_css_var("--bg-secondary", "#1a1d2e");
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", bg_color).attr("rx", 12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chart_w = width - margin.left - margin.right;

    const x_scale = d3.scaleLinear()
      .domain([0, d3.max(sorted, (d) => d.anomaly_score) ?? 1])
      .range([0, chart_w]).nice();

    const y_scale = d3.scaleBand()
      .domain(sorted.map((d) => `${d.prov_name_th} ${d.cons_no}`))
      .range([0, sorted.length * bar_height]).padding(0.15);

    const text_color = get_css_var("--text-primary", "#e8eaed");
    const text_muted = get_css_var("--text-muted", "#6b7280");
    const grid_color = get_css_var("--border-primary", "#2d3154");

    // Grid
    g.selectAll(".grid-x").data(x_scale.ticks(5)).join("line")
      .attr("x1", (d) => x_scale(d)).attr("x2", (d) => x_scale(d))
      .attr("y1", 0).attr("y2", sorted.length * bar_height)
      .attr("stroke", grid_color).attr("stroke-opacity", 0.2).attr("stroke-dasharray", "2,4");

    // Bars with gradient based on score
    g.selectAll(".bar").data(sorted).join("rect")
      .attr("x", 0).attr("y", (d) => y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0)
      .attr("width", (d) => x_scale(d.anomaly_score))
      .attr("height", y_scale.bandwidth())
      .attr("fill", (d) => {
        const score = d.anomaly_score;
        if (score > 60) return "#ef4444";
        if (score > 40) return "#f97316";
        if (score > 20) return "#eab308";
        return "#22c55e";
      })
      .attr("fill-opacity", 0.7).attr("rx", 3);

    // Party dots
    g.selectAll(".party-dot").data(sorted).join("circle")
      .attr("cx", -margin.left + 12)
      .attr("cy", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("r", 4).attr("fill", (d) => d.party_color);

    // Area labels
    g.selectAll(".area-label").data(sorted).join("text")
      .attr("x", -8)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", text_color)
      .style("font-size", "9px").style("font-weight", "500")
      .text((d) => {
        const label = `${d.prov_name_th} ${d.cons_no}`;
        return label.length > 16 ? label.slice(0, 16) + "..." : label;
      });

    // Score labels
    g.selectAll(".val-label").data(sorted).join("text")
      .attr("x", (d) => x_scale(d.anomaly_score) + 5)
      .attr("y", (d) => (y_scale(`${d.prov_name_th} ${d.cons_no}`) ?? 0) + y_scale.bandwidth() / 2)
      .attr("dy", "0.35em").attr("fill", text_color)
      .style("font-size", "9px").style("font-weight", "700")
      .text((d) => d.anomaly_score.toFixed(1));

    // X axis
    g.append("g").attr("transform", `translate(0,${sorted.length * bar_height})`)
      .call(d3.axisBottom(x_scale).ticks(5))
      .call((sel) => {
        sel.selectAll("text").attr("fill", text_muted).style("font-size", "10px");
        sel.select(".domain").attr("stroke", grid_color);
        sel.selectAll(".tick line").attr("stroke", grid_color);
      });

    console.log("[ballot_forensics] Anomaly score chart rendered");
  }, [all_items, render_key]);

  // ── Table sort handler ─────────────────────

  /**
   * Handle table column sort toggle.
   *
   * @param col - Column key to sort by.
   */
  const handle_sort = useCallback((col: string) => {
    console.log(`[ballot_forensics] Sort toggled: ${col}`);
    if (sort_col === col) {
      set_sort_dir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      set_sort_col(col);
      set_sort_dir("desc");
    }
  }, [sort_col]);

  // ── Sorted table data ─────────────────────

  const sorted_table = useMemo(() => {
    const items = [...filtered_items];
    items.sort((a, b) => {
      const av = a[sort_col as keyof ForensicsItem] ?? 0;
      const bv = b[sort_col as keyof ForensicsItem] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sort_dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av);
      const nb = Number(bv);
      return sort_dir === "asc" ? na - nb : nb - na;
    });
    return items;
  }, [filtered_items, sort_col, sort_dir]);

  /**
   * Handle party filter click.
   *
   * @param party_name - Party name to filter by, or null for all.
   */
  const handle_party_click = useCallback((party_name: string) => {
    console.log(`[ballot_forensics] Filter toggled: ${party_name}`);
    set_selected_party((prev) => (prev === party_name ? null : party_name));
  }, []);

  /**
   * Render sort indicator arrow for table headers.
   *
   * @param col - Column key.
   * @returns Sort indicator string.
   */
  const sort_indicator = (col: string): string => {
    if (sort_col !== col) return "";
    return sort_dir === "asc" ? " \u25B2" : " \u25BC";
  };

  // ── Render ─────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-primary">
      <TopBar />

      {/* Sub-bar */}
      <div className="hidden sm:block fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-[90]">
        <div className="flex items-center gap-1 bg-bg-secondary/95 backdrop-blur-md border border-border-primary rounded-full px-2 py-1.5 shadow-[0_4px_24px_var(--shadow-tooltip)]">
          <a href={`/${locale}`} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-accent whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t("title")}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-20 sm:pt-32 pb-12">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">{t("title")}</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6 sm:mb-10">{t("subtitle")}</p>

        {/* ── Section 1: Overview Cards ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-4">{t("overview_title")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* MP Invalid */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_mp_invalid")}</div>
              <div className="text-xl font-bold text-red-400">{overview.total_mp_invalid.toLocaleString()}</div>
            </div>
            {/* PL Invalid */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_pl_invalid")}</div>
              <div className="text-xl font-bold text-red-400">{overview.total_pl_invalid.toLocaleString()}</div>
            </div>
            {/* MP Blank */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_mp_blank")}</div>
              <div className="text-xl font-bold text-yellow-400">{overview.total_mp_blank.toLocaleString()}</div>
            </div>
            {/* PL Blank */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_pl_blank")}</div>
              <div className="text-xl font-bold text-yellow-400">{overview.total_pl_blank.toLocaleString()}</div>
            </div>
            {/* Avg Invalid Diff */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_avg_invalid_diff")}</div>
              <div className="text-xl font-bold" style={{ color: overview.avg_invalid_diff > 0 ? "#22c55e" : "#ef4444" }}>
                {overview.avg_invalid_diff > 0 ? "+" : ""}{overview.avg_invalid_diff.toFixed(3)}%
              </div>
            </div>
            {/* Paused */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_paused")}</div>
              <div className="text-xl font-bold text-orange-400">{overview.paused_count}</div>
            </div>
            {/* Incomplete */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_incomplete")}</div>
              <div className="text-xl font-bold text-orange-400">{overview.incomplete_count}</div>
            </div>
            {/* Avg Ref Gap */}
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_avg_ref_gap")}</div>
              <div className="text-xl font-bold text-purple-400">{overview.avg_ref_gap.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Invalid Vote Scatter ── */}
        <div className="mb-8" ref={scatter_invalid_container_ref}>
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
              <svg ref={scatter_invalid_ref} className="w-full" />
            </div>
            <div className="scatter-tooltip absolute pointer-events-none bg-bg-primary/95 border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary shadow-lg z-50" style={{ display: "none" }} />
          </div>

          <div className="flex items-center gap-6 mt-3 px-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-accent opacity-50" style={{ borderTop: "1.5px dashed var(--accent)" }} />
              <span className="text-xs text-text-secondary">{t("scatter_diagonal")}</span>
            </div>
          </div>
        </div>

        {/* ── Section 3: Invalid & Blank Diff Bar Chart ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("diff_bar_title")}</h2>
          <p className="text-xs text-text-muted mb-3">{t("diff_bar_desc")}</p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => set_diff_mode("invalid")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                diff_mode === "invalid"
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-bg-secondary border-border-primary text-text-secondary hover:border-border-hover"
              }`}
            >
              {t("mode_invalid")}
            </button>
            <button
              onClick={() => set_diff_mode("blank")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                diff_mode === "blank"
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-bg-secondary border-border-primary text-text-secondary hover:border-border-hover"
              }`}
            >
              {t("mode_blank")}
            </button>
          </div>

          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={bar_diff_ref} className="w-full" />
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

        {/* ── Section 4: Reporting Completeness ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("completeness_title")}</h2>
          <p className="text-xs text-text-muted mb-3">{t("completeness_desc")}</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_paused")}</div>
              <div className="text-2xl font-bold text-red-400">{overview.paused_count}</div>
              <div className="text-[10px] text-text-secondary mt-1">{t("of_total")} {all_items.length}</div>
            </div>
            <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
              <div className="text-[10px] text-text-muted uppercase mb-1">{t("card_incomplete")}</div>
              <div className="text-2xl font-bold text-orange-400">{overview.incomplete_count}</div>
              <div className="text-[10px] text-text-secondary mt-1">{t("below_100")}</div>
            </div>
          </div>

          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={bar_completeness_ref} className="w-full" />
          </div>
          <div className="flex items-center gap-6 mt-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#f97316] opacity-70" />
              <span className="text-xs text-text-secondary">{t("legend_counting")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#ef4444] opacity-70" />
              <span className="text-xs text-text-secondary">{t("legend_paused")}</span>
            </div>
          </div>
        </div>

        {/* ── Section 5: Referendum Cross-Reference ── */}
        <div className="mb-8" ref={scatter_ref_container_ref}>
          <h2 className="text-base font-bold text-text-primary mb-2">{t("ref_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("ref_desc")}</p>

          <div className="relative">
            <div className="bg-bg-secondary border border-border-primary rounded-2xl p-2 overflow-hidden">
              <svg ref={scatter_ref_ref} className="w-full" />
            </div>
            <div className="scatter-tooltip absolute pointer-events-none bg-bg-primary/95 border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary shadow-lg z-50" style={{ display: "none" }} />
          </div>
        </div>

        {/* ── Section 6: Composite Anomaly Score ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("anomaly_title")}</h2>
          <p className="text-xs text-text-muted mb-3">{t("anomaly_desc")}</p>

          <div className="flex flex-wrap items-center gap-4 mb-4 text-[10px] text-text-muted">
            <span className="font-semibold">{t("anomaly_weights")}:</span>
            <span>|{t("wt_invalid")}| 30%</span>
            <span>|{t("wt_blank")}| 20%</span>
            <span>|{t("wt_turnout")}| 25%</span>
            <span>|{t("wt_referendum")}| 15%</span>
            <span>{t("wt_completeness")} 10%</span>
          </div>

          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 overflow-x-auto">
            <svg ref={bar_anomaly_ref} className="w-full" />
          </div>
          <div className="flex items-center gap-4 mt-3 px-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#22c55e] opacity-70" />
              <span className="text-xs text-text-secondary">{t("score_low")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#eab308] opacity-70" />
              <span className="text-xs text-text-secondary">{t("score_medium")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#f97316] opacity-70" />
              <span className="text-xs text-text-secondary">{t("score_high")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-[#ef4444] opacity-70" />
              <span className="text-xs text-text-secondary">{t("score_critical")}</span>
            </div>
          </div>
        </div>

        {/* ── Section 7: Interactive Drilldown Table ── */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-text-primary mb-2">{t("table_title")}</h2>
          <p className="text-xs text-text-muted mb-4">{t("table_desc")}</p>

          <div className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/50">
                    <th className="text-left px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("prov_name_th")}>
                      {t("col_area")}{sort_indicator("prov_name_th")}
                    </th>
                    <th className="text-left px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("party_name")}>
                      {t("col_party")}{sort_indicator("party_name")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("mp_invalid_pct")}>
                      {t("col_mp_inv")}{sort_indicator("mp_invalid_pct")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("pl_invalid_pct")}>
                      {t("col_pl_inv")}{sort_indicator("pl_invalid_pct")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("invalid_diff")}>
                      {t("col_inv_diff")}{sort_indicator("invalid_diff")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("mp_blank_pct")}>
                      {t("col_mp_blank")}{sort_indicator("mp_blank_pct")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("blank_diff")}>
                      {t("col_blank_diff")}{sort_indicator("blank_diff")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("turnout_diff_pct")}>
                      {t("col_turnout_diff")}{sort_indicator("turnout_diff_pct")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("percent_count")}>
                      {t("col_counted")}{sort_indicator("percent_count")}
                    </th>
                    <th className="text-right px-3 py-3 text-text-muted font-semibold cursor-pointer hover:text-accent whitespace-nowrap" onClick={() => handle_sort("anomaly_score")}>
                      {t("col_score")}{sort_indicator("anomaly_score")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted_table.map((item, idx) => (
                    <tr
                      key={`${item.cons_id}-${idx}`}
                      className={`border-b border-border-primary/50 hover:bg-bg-tertiary/30 transition-colors ${
                        item.anomaly_score > 50 ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-text-primary whitespace-nowrap">{item.prov_name_th} {item.cons_no}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.party_color }} />
                          <span className="text-text-primary truncate max-w-[100px]">{item.party_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-text-secondary">{item.mp_invalid_pct.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-right text-text-secondary">{item.pl_invalid_pct.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: item.invalid_diff > 0 ? "#22c55e" : item.invalid_diff < 0 ? "#ef4444" : "inherit" }}>
                        {item.invalid_diff > 0 ? "+" : ""}{item.invalid_diff.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-text-secondary">{item.mp_blank_pct.toFixed(2)}%</td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: item.blank_diff > 0 ? "#22c55e" : item.blank_diff < 0 ? "#ef4444" : "inherit" }}>
                        {item.blank_diff > 0 ? "+" : ""}{item.blank_diff.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: item.turnout_diff_pct > 0 ? "#22c55e" : item.turnout_diff_pct < 0 ? "#ef4444" : "inherit" }}>
                        {item.turnout_diff_pct > 0 ? "+" : ""}{item.turnout_diff_pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={item.percent_count < 100 ? "text-orange-400 font-bold" : "text-text-secondary"}>
                          {item.percent_count.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          item.anomaly_score > 60 ? "bg-red-500/15 text-red-400" :
                          item.anomaly_score > 40 ? "bg-orange-500/15 text-orange-400" :
                          item.anomaly_score > 20 ? "bg-yellow-500/15 text-yellow-400" :
                          "bg-green-500/15 text-green-400"
                        }`}>
                          {item.anomaly_score.toFixed(1)}
                        </span>
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
