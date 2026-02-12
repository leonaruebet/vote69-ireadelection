/**
 * Party Analysis page - Anomaly detection visualization by political party.
 *
 * @description Server component that loads constituency GeoJSON and
 *              election data, then passes enriched features and election
 *              lookups to PartyAnalysisClient for interactive D3 charts.
 */

import {
  load_constituency_geojson,
  fetch_ect_data,
  enrich_constituency_features,
  build_election_lookups,
} from "@/lib/data";
import PartyAnalysisClient from "@/components/party_analysis_client";
import { useTranslations } from "next-intl";

/**
 * Error fallback component for data load failures.
 *
 * @param msg - Error message to display.
 * @returns Error UI with retry link.
 */
function ErrorFallback({ msg }: { msg: string }) {
  /* eslint-disable react-hooks/rules-of-hooks */
  const t = useTranslations("error");

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="text-center max-w-sm px-8">
        <h2 className="text-red-500 text-lg font-bold mb-2">
          {t("failed_to_load")}
        </h2>
        <p className="text-sm text-text-muted mb-4">{msg}</p>
        <a
          href="/"
          className="inline-block px-5 py-2 rounded-md border border-accent text-accent-light text-sm hover:bg-accent hover:text-white transition-colors"
        >
          {t("retry")}
        </a>
      </div>
    </div>
  );
}

/**
 * Party Analysis page server component.
 *
 * @returns PartyAnalysisClient with enriched features and election lookups.
 */
export default async function PartyAnalysisPage() {
  console.log("[party_analysis] Server-side data loading...");

  try {
    const [geojson, ect_records, election_lookups] = await Promise.all([
      Promise.resolve(load_constituency_geojson()),
      fetch_ect_data(),
      build_election_lookups(),
    ]);

    const features = enrich_constituency_features(geojson, ect_records);

    console.log(
      `[party_analysis] Passing ${features.length} features + election lookups to client`
    );

    return (
      <PartyAnalysisClient
        features={features}
        election_lookups={election_lookups}
      />
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[party_analysis] Data load failed:", msg);

    return <ErrorFallback msg={msg} />;
  }
}
