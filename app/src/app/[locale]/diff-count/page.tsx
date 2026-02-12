/**
 * Heatmap page - Diff between constituency MP and party list votes.
 *
 * @description Server component that loads constituency GeoJSON and
 *              election data, then passes enriched features and diff
 *              lookups to the DiffHeatmapClient for interactive rendering.
 */

import {
  load_constituency_geojson,
  fetch_ect_data,
  enrich_constituency_features,
  build_election_lookups,
} from "@/lib/data";
import Link from "next/link";
import DiffHeatmapClient from "@/components/diff_heatmap_client";
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
 * Heatmap page server component.
 *
 * @returns DiffHeatmapClient with enriched features and election lookups.
 */
export default async function HeatmapPage() {
  console.log("[heatmap] Server-side data loading...");

  let features: Awaited<ReturnType<typeof enrich_constituency_features>>;
  let election_lookups: Awaited<ReturnType<typeof build_election_lookups>>;

  try {
    const [geojson, ect_records, lookups] = await Promise.all([
      Promise.resolve(load_constituency_geojson()),
      fetch_ect_data(),
      build_election_lookups(),
    ]);

    features = enrich_constituency_features(geojson, ect_records);
    election_lookups = lookups;

    console.log(
      `[heatmap] Passing ${features.length} features + diff lookups to client`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[heatmap] Data load failed:", msg);
    return <ErrorFallback msg={msg} />;
  }

  return (
    <DiffHeatmapClient
      features={features}
      election_lookups={election_lookups}
    />
  );
}
