/**
 * Server-side data fetching and transformation utilities.
 *
 * @description Handles loading constituency-level GeoJSON + ECT data
 *              on the server, matching by Thai province name + cons_no.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type {
  ConstituencyRecord,
  ConstituencyData,
  ConstituencyFeatureProps,
  TotalStats,
  RawStatsCons,
  RawStatsReferendum,
  RawMpCandidate,
  RawPartyOverview,
  ConsWinnerData,
  ConsPartyListData,
  ConsReferendumData,
  ConsDiffData,
  ConsBallotForensicsData,
  ElectionLookups,
} from "@/types/constituency";
import {
  DATA_URLS,
  PROV_ID_TO_NAME,
  PROV_ID_TO_THAI,
  THAI_NAME_TO_PROV_ID,
} from "@/lib/constants";
import type { GeoJSON } from "geojson";

// ── Data fetching (server-side) ────────────────

/**
 * Load the constituency-level GeoJSON from public/data.
 *
 * @returns Parsed GeoJSON FeatureCollection with 400 constituency polygons.
 */
export function load_constituency_geojson(): GeoJSON.FeatureCollection {
  console.log("[data] Loading constituency GeoJSON from disk...");
  const file_path = join(process.cwd(), "public", "data", "constituencies.json");
  const raw = readFileSync(file_path, "utf-8");
  const geojson = JSON.parse(raw) as GeoJSON.FeatureCollection;
  console.log(`[data] Loaded ${geojson.features.length} constituency features`);
  return geojson;
}

/**
 * Fetch ECT constituency data from the API.
 *
 * @returns Array of raw constituency records.
 * @throws Error if fetch fails.
 */
export async function fetch_ect_data(): Promise<ConstituencyRecord[]> {
  console.log("[data] Fetching ECT constituency data...");
  const res = await fetch(DATA_URLS.constituency, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`ECT fetch failed: ${res.status}`);
  }

  const records = (await res.json()) as ConstituencyRecord[];
  console.log(`[data] Fetched ${records.length} ECT records`);
  return records;
}

// ── Data matching ──────────────────────────────

/**
 * Build a lookup map from ECT records keyed by "prov_id:cons_no".
 *
 * @param records - Raw ECT constituency records.
 * @returns Map of composite key → ConstituencyData.
 */
function build_ect_lookup(
  records: ConstituencyRecord[]
): Map<string, ConstituencyData> {
  const lookup = new Map<string, ConstituencyData>();

  for (const rec of records) {
    if (rec.cons_no === 0) continue; // Skip province-level summary records

    const key = `${rec.prov_id}:${rec.cons_no}`;
    lookup.set(key, {
      cons_id: rec.cons_id,
      cons_no: rec.cons_no,
      prov_id: rec.prov_id,
      prov_name_th: PROV_ID_TO_THAI[rec.prov_id] || "",
      prov_name_en: PROV_ID_TO_NAME[rec.prov_id] || rec.prov_id,
      zone: rec.zone || [],
      vote_stations: rec.total_vote_stations || 0,
      registered_voters: rec.registered_vote || 0,
    });
  }

  console.log(`[data] Built ECT lookup with ${lookup.size} entries`);
  return lookup;
}

/**
 * Enrich constituency GeoJSON features with matched ECT data.
 *
 * @param geojson - Constituency-level GeoJSON (400 features with P_name, CONS_no).
 * @param ect_records - Raw ECT constituency records.
 * @returns Enriched features with matched constituency data.
 */
export function enrich_constituency_features(
  geojson: GeoJSON.FeatureCollection,
  ect_records: ConstituencyRecord[]
): GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>[] {
  console.log("[data] Enriching constituency features...");

  const ect_lookup = build_ect_lookup(ect_records);
  let matched = 0;
  let unmatched = 0;

  const enriched = geojson.features.map((f) => {
    const p_name = (f.properties?.P_name as string) || "";
    const cons_no = (f.properties?.CONS_no as number) || 0;

    // Resolve prov_id from Thai name
    const prov_id = THAI_NAME_TO_PROV_ID[p_name];

    let cons_data: ConstituencyData | null = null;
    if (prov_id && cons_no > 0) {
      const key = `${prov_id}:${cons_no}`;
      cons_data = ect_lookup.get(key) || null;
    }

    if (cons_data) {
      matched++;
    } else {
      unmatched++;
      if (prov_id) {
        console.warn(`[data] No ECT match: ${p_name} เขต ${cons_no} (${prov_id})`);
      } else {
        console.warn(`[data] Unknown province: "${p_name}"`);
      }
    }

    const label = cons_data
      ? `${cons_data.prov_name_th} เขต ${cons_no}`
      : `${p_name} เขต ${cons_no}`;

    const props: ConstituencyFeatureProps = {
      ...f.properties,
      P_name: p_name,
      CONS_no: cons_no,
      _cons_data: cons_data,
      _label: label,
    };

    return {
      ...f,
      properties: props,
    } as GeoJSON.Feature<GeoJSON.Geometry, ConstituencyFeatureProps>;
  });

  console.log(`[data] Enriched: ${matched} matched, ${unmatched} unmatched`);
  return enriched;
}

// ── Totals ─────────────────────────────────────

/**
 * Calculate summary totals from ECT records.
 *
 * @param records - Raw ECT constituency records.
 * @returns TotalStats with aggregate numbers.
 */
export function calculate_totals(records: ConstituencyRecord[]): TotalStats {
  const prov_set = new Set<string>();
  let constituencies = 0;
  let registered_voters = 0;
  let vote_stations = 0;

  for (const rec of records) {
    prov_set.add(rec.prov_id);
    if (rec.cons_no > 0) {
      constituencies++;
      registered_voters += rec.registered_vote || 0;
      vote_stations += rec.total_vote_stations || 0;
    }
  }

  return {
    provinces: prov_set.size,
    constituencies,
    registered_voters,
    vote_stations,
  };
}

// ── Election data fetching ─────────────────────

/**
 * Generic JSON fetcher with configurable revalidation.
 *
 * @param url - URL to fetch.
 * @param revalidate - Cache revalidation in seconds (300 for live stats, 3600 for static refs).
 * @returns Parsed JSON response.
 */
async function fetch_json<T>(url: string, revalidate: number): Promise<T> {
  console.log(`[data] Fetching ${url.split("/").pop()}...`);
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch live constituency election results.
 *
 * @returns Raw stats_cons response with winners + party list per constituency.
 */
export async function fetch_stats_cons(): Promise<RawStatsCons> {
  console.log("[data] fetch_stats_cons start");
  const data = await fetch_json<RawStatsCons>(DATA_URLS.stats_cons, 300);
  console.log(
    `[data] fetch_stats_cons done: ${data.result_province?.length ?? 0} provinces`
  );
  return data;
}

/**
 * Fetch live referendum results.
 *
 * @returns Raw stats_referendum response with yes/no/abstain per constituency.
 */
export async function fetch_stats_referendum(): Promise<RawStatsReferendum> {
  console.log("[data] fetch_stats_referendum start");
  const data = await fetch_json<RawStatsReferendum>(
    DATA_URLS.stats_referendum,
    300
  );
  console.log(
    `[data] fetch_stats_referendum done: ${data.result_province?.length ?? 0} provinces`
  );
  return data;
}

/**
 * Fetch MP candidate reference data.
 *
 * @returns Array of candidate records (names + images).
 */
export async function fetch_mp_candidates(): Promise<RawMpCandidate[]> {
  console.log("[data] fetch_mp_candidates start");
  const data = await fetch_json<RawMpCandidate[]>(
    DATA_URLS.info_mp_candidate,
    3600
  );
  console.log(`[data] fetch_mp_candidates done: ${data.length} candidates`);
  return data;
}

/**
 * Fetch party overview reference data.
 *
 * @returns Array of party records (57 parties: name, color, logo).
 */
export async function fetch_party_overview(): Promise<RawPartyOverview[]> {
  console.log("[data] fetch_party_overview start");
  const data = await fetch_json<RawPartyOverview[]>(
    DATA_URLS.info_party_overview,
    3600
  );
  console.log(`[data] fetch_party_overview done: ${data.length} parties`);
  return data;
}

// ── Election lookup builders ───────────────────

/**
 * Build constituency winner lookup from stats + candidate + party data.
 *
 * @param stats - Raw stats_cons response.
 * @param candidates - Array of MP candidate records.
 * @param parties - Array of party overview records.
 * @returns Record keyed by cons_id → resolved winner data.
 */
export function build_winner_lookup(
  stats: RawStatsCons,
  candidates: RawMpCandidate[],
  parties: RawPartyOverview[]
): Record<string, ConsWinnerData> {
  console.log("[data] build_winner_lookup start");

  // Build sub-lookup: mp_app_id → candidate name
  const candidate_map = new Map<string, string>();
  for (const c of candidates) {
    candidate_map.set(c.mp_app_id, c.mp_app_name);
  }

  // Build sub-lookup: party_id (number) → { name, color }
  const party_map = new Map<number, { name: string; color: string }>();
  for (const p of parties) {
    party_map.set(Number(p.id), { name: p.name, color: p.color });
  }

  const result: Record<string, ConsWinnerData> = {};

  for (const prov of stats.result_province || []) {
    for (const cons of prov.constituencies || []) {
      // Skip summary records (e.g. BKK_0)
      if (cons.cons_id.endsWith("_0")) continue;

      // Find rank-1 candidate (winner)
      const winner = cons.candidates?.find((c) => c.mp_app_rank === 1);
      if (!winner) continue;

      const cand_name = candidate_map.get(winner.mp_app_id) || "ไม่ทราบชื่อ";
      const party = party_map.get(winner.party_id) || {
        name: "ไม่ทราบพรรค",
        color: "#666",
      };

      // Find winner's party party-list vote % in the same constituency
      const party_result = cons.result_party?.find(
        (rp) => rp.party_id === winner.party_id
      );
      const pl_vote_pct = party_result?.party_list_vote_percent ?? 0;

      result[cons.cons_id] = {
        candidate_name: cand_name,
        party_name: party.name,
        party_color: party.color,
        vote_count: winner.mp_app_vote,
        vote_percent: winner.mp_app_vote_percent,
        turn_out: cons.turn_out || 0,
        party_list_vote_percent: pl_vote_pct,
      };
    }
  }

  console.log(
    `[data] build_winner_lookup done: ${Object.keys(result).length} winners`
  );
  return result;
}

/**
 * Build constituency party-list lookup from stats + party data.
 *
 * @param stats - Raw stats_cons response.
 * @param parties - Array of party overview records.
 * @returns Record keyed by cons_id → top 3 party list results + turn out.
 */
export function build_party_list_lookup(
  stats: RawStatsCons,
  parties: RawPartyOverview[]
): Record<string, ConsPartyListData> {
  console.log("[data] build_party_list_lookup start");

  const party_map = new Map<number, { name: string; color: string }>();
  for (const p of parties) {
    party_map.set(Number(p.id), { name: p.name, color: p.color });
  }

  const result: Record<string, ConsPartyListData> = {};

  for (const prov of stats.result_province || []) {
    for (const cons of prov.constituencies || []) {
      if (cons.cons_id.endsWith("_0")) continue;
      if (!cons.result_party?.length) continue;

      // Sort by party_list_vote descending, take top 3
      const sorted = [...cons.result_party]
        .filter((rp) => rp.party_list_vote > 0)
        .sort((a, b) => b.party_list_vote - a.party_list_vote)
        .slice(0, 3);

      const top_parties = sorted.map((rp) => {
        const party = party_map.get(rp.party_id) || {
          name: "ไม่ทราบพรรค",
          color: "#666",
        };
        return {
          party_name: party.name,
          party_color: party.color,
          votes: rp.party_list_vote,
          vote_percent: rp.party_list_vote_percent,
        };
      });

      result[cons.cons_id] = {
        turn_out: cons.party_list_turn_out,
        top_parties,
      };
    }
  }

  console.log(
    `[data] build_party_list_lookup done: ${Object.keys(result).length} constituencies`
  );
  return result;
}

/**
 * Build constituency referendum lookup from referendum data.
 *
 * @param referendum - Raw stats_referendum response.
 * @returns Record keyed by cons_id → referendum percentages.
 */
export function build_referendum_lookup(
  referendum: RawStatsReferendum
): Record<string, ConsReferendumData> {
  console.log("[data] build_referendum_lookup start");

  const result: Record<string, ConsReferendumData> = {};

  for (const prov of referendum.result_province || []) {
    for (const cons of prov.constituencies || []) {
      if (cons.cons_id.endsWith("_0")) continue;

      // Take first (and likely only) question's results
      const question_keys = Object.keys(cons.referendum_results || {});
      if (!question_keys.length) continue;

      const ref_data = cons.referendum_results[question_keys[0]];
      if (!ref_data) continue;

      result[cons.cons_id] = {
        percent_yes: ref_data.percent_yes,
        percent_no: ref_data.percent_no,
        percent_abstained: ref_data.percent_abstained,
      };
    }
  }

  console.log(
    `[data] build_referendum_lookup done: ${Object.keys(result).length} constituencies`
  );
  return result;
}

/**
 * Build diff lookup comparing constituency-level MP turnout vs party list turnout.
 *
 * @description For each constituency, computes the net difference between
 *              total MP ballot turnout and total party list ballot turnout.
 *              This reveals areas where voter participation differs across ballots.
 * @param stats - Raw stats_cons response with constituency-level turnout data.
 * @returns Record keyed by cons_id → ConsDiffData with computed net diffs.
 */
export function build_diff_lookup(
  stats: RawStatsCons
): Record<string, ConsDiffData> {
  console.log("[data] build_diff_lookup start");

  const result: Record<string, ConsDiffData> = {};

  for (const prov of stats.result_province || []) {
    for (const cons of prov.constituencies || []) {
      if (cons.cons_id.endsWith("_0")) continue;

      const mp_turn_out = cons.turn_out ?? 0;
      const mp_percent = cons.percent_turn_out ?? 0;
      const pl_turn_out = cons.party_list_turn_out ?? 0;
      const pl_percent = cons.party_list_percent_turn_out ?? 0;

      result[cons.cons_id] = {
        mp_turn_out,
        mp_percent_turn_out: mp_percent,
        party_list_turn_out: pl_turn_out,
        party_list_percent_turn_out: pl_percent,
        diff_count: mp_turn_out - pl_turn_out,
        diff_percent: mp_percent - pl_percent,
      };
    }
  }

  console.log(
    `[data] build_diff_lookup done: ${Object.keys(result).length} constituencies`
  );
  return result;
}

/**
 * Build ballot forensics lookup extracting invalid/blank/valid votes per constituency.
 *
 * @description Extracts all invalid, blank, and valid vote data from raw ECT stats.
 *              Computes percentages relative to turnout and joins with constituency
 *              records for registered voter counts and station totals.
 * @param stats - Raw stats_cons response with constituency-level vote data.
 * @param ect_records - Raw ECT constituency records for registered_vote + total_vote_stations.
 * @returns Record keyed by cons_id → ConsBallotForensicsData.
 */
export function build_forensics_lookup(
  stats: RawStatsCons,
  ect_records: ConstituencyRecord[]
): Record<string, ConsBallotForensicsData> {
  console.log("[data] build_forensics_lookup start");

  // Build sub-lookup: cons_id → { registered_vote, total_vote_stations }
  const cons_ref = new Map<string, { registered: number; stations: number }>();
  for (const rec of ect_records) {
    if (rec.cons_no === 0) continue;
    cons_ref.set(rec.cons_id, {
      registered: rec.registered_vote ?? 0,
      stations: rec.total_vote_stations ?? 0,
    });
  }

  const result: Record<string, ConsBallotForensicsData> = {};

  for (const prov of stats.result_province || []) {
    for (const cons of prov.constituencies || []) {
      if (cons.cons_id.endsWith("_0")) continue;

      const mp_turnout = cons.turn_out ?? 0;
      const pl_turnout = cons.party_list_turn_out ?? 0;

      const mp_invalid = cons.invalid_votes ?? 0;
      const pl_invalid = cons.party_list_invalid_votes ?? 0;
      const mp_blank = cons.blank_votes ?? 0;
      const pl_blank = cons.party_list_blank_votes ?? 0;
      const mp_valid = cons.valid_votes ?? 0;
      const pl_valid = cons.party_list_valid_votes ?? 0;

      /**
       * Safely compute percentage: value / total * 100.
       *
       * @param value - Numerator.
       * @param total - Denominator (turnout).
       * @returns Percentage, or 0 if total is 0.
       */
      const safe_pct = (value: number, total: number): number =>
        total > 0 ? (value / total) * 100 : 0;

      const mp_invalid_pct = safe_pct(mp_invalid, mp_turnout);
      const pl_invalid_pct = safe_pct(pl_invalid, pl_turnout);
      const mp_blank_pct = safe_pct(mp_blank, mp_turnout);
      const pl_blank_pct = safe_pct(pl_blank, pl_turnout);
      const mp_valid_pct = safe_pct(mp_valid, mp_turnout);
      const pl_valid_pct = safe_pct(pl_valid, pl_turnout);

      const ref = cons_ref.get(cons.cons_id);
      const registered = ref?.registered ?? 0;
      const total_stations = ref?.stations ?? 0;

      result[cons.cons_id] = {
        mp_invalid_votes: mp_invalid,
        mp_invalid_pct,
        pl_invalid_votes: pl_invalid,
        pl_invalid_pct,
        invalid_diff: mp_invalid_pct - pl_invalid_pct,
        mp_blank_votes: mp_blank,
        mp_blank_pct,
        pl_blank_votes: pl_blank,
        pl_blank_pct,
        blank_diff: mp_blank_pct - pl_blank_pct,
        mp_valid_votes: mp_valid,
        mp_valid_pct,
        pl_valid_votes: pl_valid,
        pl_valid_pct,
        valid_diff: mp_valid_pct - pl_valid_pct,
        counted_vote_stations: cons.counted_vote_stations ?? 0,
        total_vote_stations: total_stations,
        percent_count: cons.percent_count ?? 0,
        pause_report: cons.pause_report ?? false,
        registered_voters: registered,
        mp_turnout_of_registered: safe_pct(mp_turnout, registered),
      };
    }
  }

  console.log(
    `[data] build_forensics_lookup done: ${Object.keys(result).length} constituencies`
  );
  return result;
}

/**
 * Fetch all election data and build combined lookups.
 * Resilient: returns empty lookups on failure.
 *
 * @returns ElectionLookups bundle with winners, party_list, referendum, diff, forensics.
 */
export async function build_election_lookups(
  ect_records?: ConstituencyRecord[]
): Promise<ElectionLookups> {
  console.log("[data] build_election_lookups start");

  const empty_lookups: ElectionLookups = {
    winners: {},
    party_list: {},
    referendum: {},
    diff: {},
    forensics: {},
  };

  try {
    const [stats_cons, stats_ref, mp_candidates, party_overview] =
      await Promise.all([
        fetch_stats_cons(),
        fetch_stats_referendum(),
        fetch_mp_candidates(),
        fetch_party_overview(),
      ]);

    const winners = build_winner_lookup(stats_cons, mp_candidates, party_overview);
    const party_list = build_party_list_lookup(stats_cons, party_overview);
    const referendum = build_referendum_lookup(stats_ref);
    const diff = build_diff_lookup(stats_cons);
    const forensics = build_forensics_lookup(stats_cons, ect_records ?? []);

    console.log("[data] build_election_lookups done successfully");
    return { winners, party_list, referendum, diff, forensics };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[data] Election data fetch failed: ${msg}`);
    console.warn("[data] Falling back to empty election lookups");
    return empty_lookups;
  }
}
