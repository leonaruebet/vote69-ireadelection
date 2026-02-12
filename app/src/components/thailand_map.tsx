"use client";

/**
 * ThailandMap - D3 choropleth of 400 election constituencies.
 *
 * @description Renders zoomable SVG map with constituency-level polygons,
 *              colored by selected metric. Uses fitExtent for projection.
 *              Theme-aware: reads map colors from CSS custom properties.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import * as d3 from "d3";
import type { GeoJSON } from "geojson";
import type {
  ConstituencyFeatureProps,
  ConstituencyData,
  MetricKey,
} from "@/types/constituency";
import { MAP_CONFIG, COLOR_SCHEME, get_map_colors } from "@/lib/constants";
import { useTheme } from "@/lib/theme";

interface ThailandMapProps {
  /** Enriched constituency GeoJSON features. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Currently selected metric key. */
  metric: MetricKey;
  /** Hover callback for tooltip. */
  on_hover: (data: ConstituencyData | null, event: MouseEvent | null) => void;
  /** Optional custom fill color function. When provided, overrides default metric color scale. */
  get_fill_color?: (cons_data: ConstituencyData | null) => string;
  /** Optional centroid dot color function. Returns a fill color for a small dot at each constituency centroid. */
  get_dot_color?: (cons_data: ConstituencyData | null) => string | null;
  /** Optional label function. Returns a short string to render at each constituency centroid. */
  get_label?: (cons_data: ConstituencyData | null) => string | null;
}

/**
 * Build a quantize color scale for constituency metric values.
 *
 * @param features - Constituency features.
 * @param metric - Metric key to color by.
 * @returns D3 quantize scale.
 */
function build_color_scale(
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[],
  metric: MetricKey
): d3.ScaleQuantize<string> {
  const values: number[] = [];
  for (const f of features) {
    const d = f.properties._cons_data;
    if (d) values.push(d[metric] || 0);
  }

  const extent = d3.extent(values) as [number, number];
  if (extent[0] === extent[1]) extent[1] = extent[0] + 1;

  return d3.scaleQuantize<string>().domain(extent).range([...COLOR_SCHEME]);
}

/**
 * ThailandMap component - D3-rendered SVG choropleth.
 *
 * @param features - Constituency features with matched ECT data.
 * @param metric - Active metric for coloring.
 * @param on_hover - Callback for hover events.
 * @returns SVG map with zoom controls.
 */
export default function ThailandMap({
  features,
  metric,
  on_hover,
  get_fill_color,
  get_dot_color,
  get_label,
}: ThailandMapProps) {
  const svg_ref = useRef<SVGSVGElement>(null);
  const g_ref = useRef<SVGGElement | null>(null);
  const zoom_ref = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(
    null
  );
  const initial_tf_ref = useRef<d3.ZoomTransform | null>(null);
  const [is_mounted, set_is_mounted] = useState(false);
  const { theme } = useTheme();
  const t = useTranslations("controls");

  // ── Initial render ──
  useEffect(() => {
    if (!svg_ref.current || features.length === 0) return;
    console.log(`[map] Rendering ${features.length} constituencies`);

    const svg_el = svg_ref.current;
    const svg = d3.select(svg_el);
    svg.selectAll("*").remove();

    const rect = svg_el.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g");
    g_ref.current = g.node();

    // FeatureCollection for projection fitting
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: features as GeoJSON.Feature[],
    };

    // Auto-fit projection to SVG viewport
    const padding = 20;
    const projection = d3.geoMercator().fitExtent(
      [
        [padding, padding],
        [width - padding, height - padding],
      ],
      fc
    );
    const path_gen = d3.geoPath().projection(projection);

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([MAP_CONFIG.zoom_min, MAP_CONFIG.zoom_max])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    zoom_ref.current = zoom;

    const initial_tf = d3.zoomIdentity;
    initial_tf_ref.current = initial_tf;
    svg.call(zoom).call(zoom.transform, initial_tf);

    // Draw constituencies
    const color_scale = get_fill_color ? null : build_color_scale(features, metric);
    const colors = get_map_colors();

    g.selectAll<
      SVGPathElement,
      GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
    >(".cons-path")
      .data(features)
      .join("path")
      .attr("class", "cons-path")
      .attr("d", (d) => path_gen(d) || "")
      .attr("fill", (d) => {
        const data = d.properties._cons_data;
        if (get_fill_color) return get_fill_color(data);
        if (!data) return colors.null_color;
        return color_scale!(data[metric] || 0);
      })
      .attr("stroke", colors.stroke_color)
      .attr("stroke-width", 0.3)
      .style("cursor", "pointer")
      .on("mouseenter", function (event: MouseEvent, d) {
        const hover_colors = get_map_colors();
        d3.select(this)
          .raise()
          .attr("stroke", hover_colors.hover_stroke)
          .attr("stroke-width", 1.2);
        on_hover(d.properties._cons_data, event);
      })
      .on("mousemove", function (event: MouseEvent, d) {
        on_hover(d.properties._cons_data, event);
      })
      .on("mouseleave", function () {
        const base_colors = get_map_colors();
        d3.select(this)
          .attr("stroke", base_colors.stroke_color)
          .attr("stroke-width", 0.3);
        on_hover(null, null);
      })
      .on("click", function (event: MouseEvent, d) {
        event.stopPropagation();
        const [[x0, y0], [x1, y1]] = path_gen.bounds(d);
        const bw = x1 - x0;
        const bh = y1 - y0;
        const bx = (x0 + x1) / 2;
        const by = (y0 + y1) / 2;
        const scale = Math.min(
          10,
          0.9 / Math.max(bw / width, bh / height)
        );
        const tx = width / 2 - scale * bx;
        const ty = height / 2 - scale * by;

        svg
          .transition()
          .duration(600)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(tx, ty).scale(scale)
          );
      });

    // Centroid direction dots (optional)
    if (get_dot_color) {
      console.log("[map] Drawing centroid direction dots");
      g.selectAll<
        SVGCircleElement,
        GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
      >(".cons-dot")
        .data(features)
        .join("circle")
        .attr("class", "cons-dot")
        .attr("cx", (d) => {
          const centroid = path_gen.centroid(d);
          return centroid[0] || 0;
        })
        .attr("cy", (d) => {
          const centroid = path_gen.centroid(d);
          return centroid[1] || 0;
        })
        .attr("r", 1.8)
        .attr("fill", (d) => get_dot_color(d.properties._cons_data) || "transparent")
        .attr("stroke", "none")
        .attr("pointer-events", "none")
        .attr("opacity", 0.85);
    }

    // Centroid text labels (optional)
    if (get_label) {
      console.log("[map] Drawing centroid labels");
      g.selectAll<
        SVGTextElement,
        GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
      >(".cons-label")
        .data(features)
        .join("text")
        .attr("class", "cons-label")
        .attr("x", (d) => path_gen.centroid(d)[0] || 0)
        .attr("y", (d) => path_gen.centroid(d)[1] || 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "2.8px")
        .attr("font-weight", "700")
        .attr("fill", colors.label_color ?? "#fff")
        .attr("stroke", colors.label_stroke ?? "#000")
        .attr("stroke-width", "0.3px")
        .attr("paint-order", "stroke")
        .attr("pointer-events", "none")
        .text((d) => get_label(d.properties._cons_data) ?? "");
    }

    // Click background to reset
    svg.on("click", () => {
      svg.transition().duration(500).call(zoom.transform, initial_tf);
    });

    set_is_mounted(true);
    console.log("[map] Render complete");

    const handle_resize = () => {
      const r = svg_el.getBoundingClientRect();
      svg.attr("viewBox", `0 0 ${r.width} ${r.height}`);
    };
    window.addEventListener("resize", handle_resize);
    return () => window.removeEventListener("resize", handle_resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  // ── Color update on metric, theme, or custom fill change ──
  useEffect(() => {
    if (!is_mounted || !g_ref.current || features.length === 0) return;
    console.log(`[map] Recoloring for metric: ${metric}, theme: ${theme}`);

    const g = d3.select(g_ref.current);
    const color_scale = get_fill_color ? null : build_color_scale(features, metric);
    const colors = get_map_colors();

    g.selectAll<
      SVGPathElement,
      GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
    >(".cons-path")
      .transition()
      .duration(MAP_CONFIG.transition_ms)
      .attr("fill", (d) => {
        const data = d.properties._cons_data;
        if (get_fill_color) return get_fill_color(data);
        if (!data) return colors.null_color;
        return color_scale!(data[metric] || 0);
      })
      .attr("stroke", colors.stroke_color);

    // Update centroid dots if present
    if (get_dot_color) {
      g.selectAll<
        SVGCircleElement,
        GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
      >(".cons-dot")
        .transition()
        .duration(MAP_CONFIG.transition_ms)
        .attr("fill", (d) => get_dot_color(d.properties._cons_data) || "transparent");
    }

    // Update centroid labels if present
    if (get_label) {
      const label_colors = get_map_colors();
      g.selectAll<
        SVGTextElement,
        GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>
      >(".cons-label")
        .text((d) => get_label(d.properties._cons_data) ?? "")
        .attr("fill", label_colors.label_color ?? "#fff")
        .attr("stroke", label_colors.label_stroke ?? "#000");
    }
  }, [metric, features, is_mounted, theme, get_fill_color, get_dot_color, get_label]);

  /** Zoom by factor. */
  const handle_zoom = useCallback((factor: number) => {
    if (!svg_ref.current || !zoom_ref.current) return;
    d3.select(svg_ref.current)
      .transition()
      .duration(300)
      .call(zoom_ref.current.scaleBy, factor);
  }, []);

  /** Reset zoom. */
  const handle_reset = useCallback(() => {
    if (
      !svg_ref.current ||
      !zoom_ref.current ||
      !initial_tf_ref.current
    )
      return;
    d3.select(svg_ref.current)
      .transition()
      .duration(500)
      .call(zoom_ref.current.transform, initial_tf_ref.current);
  }, []);

  return (
    <div className="absolute inset-0">
      <svg ref={svg_ref} className="w-full h-full" />

      <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 z-50">
        <button
          onClick={() => handle_zoom(1.5)}
          className="w-9 h-9 rounded-lg border border-border-primary bg-bg-tertiary text-text-primary flex items-center justify-center text-lg hover:bg-accent hover:border-accent hover:text-white transition-colors cursor-pointer"
          title={t("zoom_in")}
        >
          +
        </button>
        <button
          onClick={() => handle_zoom(0.67)}
          className="w-9 h-9 rounded-lg border border-border-primary bg-bg-tertiary text-text-primary flex items-center justify-center text-lg hover:bg-accent hover:border-accent hover:text-white transition-colors cursor-pointer"
          title={t("zoom_out")}
        >
          -
        </button>
        <button
          onClick={handle_reset}
          className="w-9 h-9 rounded-lg border border-border-primary bg-bg-tertiary text-text-primary flex items-center justify-center text-lg hover:bg-accent hover:border-accent hover:text-white transition-colors cursor-pointer"
          title={t("reset")}
        >
          &#8634;
        </button>
      </div>
    </div>
  );
}
