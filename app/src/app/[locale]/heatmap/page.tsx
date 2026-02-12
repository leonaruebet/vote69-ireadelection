/**
 * Heatmap Graphs page - Visualization dashboard for ballot diff analysis.
 *
 * @description Server component that loads constituency GeoJSON and
 *              election data, then passes enriched features and election
 *              lookups to HeatmapGraphsClient for interactive D3 charts.
 */

import {
  load_constituency_geojson,
  fetch_ect_data,
  enrich_constituency_features,
  build_election_lookups,
} from "@/lib/data";
import Link from "next/link";
import HeatmapGraphsClient from "@/components/heatmap_graphs_client";
import { useTranslations } from "next-intl";

/**
 * Error fallback component for data load failures.
 *
 * @param msg - Error message to display.
 * @returns Error UI with retry link.
 */
function ErrorFallback({ msg }: { msg: string }) {
  const t = useTranslations("error");

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="text-center max-w-sm px-8">
        <h2 className="text-red-500 text-lg font-bold mb-2">
          {t("failed_to_load")}
        </h2>
        <p className="text-sm text-text-muted mb-4">{msg}</p>
        <Link
          href="/"
          className="inline-block px-5 py-2 rounded-md border border-accent text-accent-light text-sm hover:bg-accent hover:text-white transition-colors"
        >
          {t("retry")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Heatmap Graphs page server component.
 *
 * @returns HeatmapGraphsClient with enriched features and election lookups.
 */
export default async function HeatmapGraphsPage() {
  console.log("[heatmap_graphs] Server-side data loading...");

  let features: Awaited<ReturnType<typeof enrich_constituency_features>>;
  let election_lookups: Awaited<ReturnType<typeof build_election_lookups>>;

  try {
    const [geojson, ect_records] = await Promise.all([
      Promise.resolve(load_constituency_geojson()),
      fetch_ect_data(),
    ]);

    election_lookups = await build_election_lookups(ect_records);
    features = enrich_constituency_features(geojson, ect_records);

    console.log(
      `[heatmap_graphs] Passing ${features.length} features + election lookups to client`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[heatmap_graphs] Data load failed:", msg);
    return <ErrorFallback msg={msg} />;
  }

  return (
    <HeatmapGraphsClient
      features={features}
      election_lookups={election_lookups}
    />
  );
}
