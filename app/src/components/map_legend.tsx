"use client";

/**
 * MapLegend - Color scale legend for the constituency map.
 *
 * @description Shows the color gradient and min/max values
 *              for the currently selected metric. Theme-aware.
 */

import { useTranslations } from "next-intl";
import type { MetricKey, ConstituencyFeatureProps } from "@/types/constituency";
import type { GeoJSON } from "geojson";
import { COLOR_SCHEME, METRICS } from "@/lib/constants";
import * as d3 from "d3";

interface MapLegendProps {
  /** Constituency features for computing extent. */
  features: GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[];
  /** Currently active metric. */
  metric: MetricKey;
}

/**
 * Color scale legend overlay.
 *
 * @param features - Constituency features for value range.
 * @param metric - Active metric key.
 * @returns Legend panel with gradient and labels.
 */
export default function MapLegend({ features, metric }: MapLegendProps) {
  const config = METRICS[metric];
  const t = useTranslations("metrics");

  const values: number[] = [];
  for (const f of features) {
    const d = f.properties._cons_data;
    if (d) values.push(d[metric] || 0);
  }
  const extent = d3.extent(values) as [number, number];

  console.log(`[map_legend] Rendering legend for metric: ${metric}`);

  return (
    <div className="absolute bottom-6 left-6 bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 z-50">
      <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider mb-2">
        {t(config.message_key)}
      </div>
      <div className="flex h-3 rounded overflow-hidden min-w-[200px]">
        {COLOR_SCHEME.map((color, i) => (
          <div key={i} className="flex-1" style={{ background: color }} />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-text-muted">
        <span>{config.format(Math.floor(extent[0] ?? 0))}</span>
        <span>{config.format(Math.ceil(extent[1] ?? 0))}</span>
      </div>
    </div>
  );
}
