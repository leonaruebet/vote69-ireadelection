/**
 * Ballot Forensics page - Deep analysis of invalid/blank/valid votes.
 *
 * @description Server component that loads constituency GeoJSON, ECT data,
 *              and election lookups (with forensics), then passes enriched
 *              features to BallotForensicsClient for interactive visualization.
 */

import {
  load_constituency_geojson,
  fetch_ect_data,
  enrich_constituency_features,
  build_election_lookups,
} from "@/lib/data";
import Link from "next/link";
import BallotForensicsClient from "@/components/ballot_forensics_client";
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
 * Ballot Forensics page server component.
 *
 * @description Passes ect_records to build_election_lookups so the forensics
 *              builder can join with registered_vote and total_vote_stations.
 * @returns BallotForensicsClient with enriched features and election lookups.
 */
export default async function BallotForensicsPage() {
  console.log("[ballot_forensics] Server-side data loading...");

  let features: Awaited<ReturnType<typeof enrich_constituency_features>>;
  let election_lookups: Awaited<ReturnType<typeof build_election_lookups>>;

  try {
    const [geojson, ect_records] = await Promise.all([
      Promise.resolve(load_constituency_geojson()),
      fetch_ect_data(),
    ]);

    // Pass ect_records so forensics builder can join registered voter data
    election_lookups = await build_election_lookups(ect_records);
    features = enrich_constituency_features(geojson, ect_records);

    console.log(
      `[ballot_forensics] Passing ${features.length} features + election lookups (with forensics) to client`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ballot_forensics] Data load failed:", msg);
    return <ErrorFallback msg={msg} />;
  }

  return (
    <BallotForensicsClient
      features={features}
      election_lookups={election_lookups}
    />
  );
}
