/**
 * Types for Thailand ECT constituency data and map visualization.
 */

/** Raw constituency record from ECT API. */
export interface ConstituencyRecord {
  cons_id: string;
  cons_no: number;
  prov_id: string;
  zone: string[];
  total_vote_stations: number;
  registered_vote: number | null;
}

/** Aggregated province-level data. */
export interface ProvinceData {
  prov_id: string;
  name_en: string;
  name_th: string;
  constituencies: number;
  registered_voters: number;
  vote_stations: number;
  zones: ZoneInfo[];
}

/** Individual constituency zone info. */
export interface ZoneInfo {
  cons_no: number;
  zone: string[];
  stations: number;
  voters: number;
}

/** Single constituency data (matched from ECT). */
export interface ConstituencyData {
  cons_id: string;
  cons_no: number;
  prov_id: string;
  prov_name_th: string;
  prov_name_en: string;
  zone: string[];
  vote_stations: number;
  registered_voters: number;
}

/** Available visualization metrics for constituency-level map. */
export type MetricKey = "registered_voters" | "vote_stations";

/**
 * Metric display configuration.
 *
 * @description Labels removed in favor of i18n message keys.
 *              Use `metrics.{message_key}` translation for display text.
 */
export interface MetricConfig {
  /** Metric identifier key. */
  key: MetricKey;
  /** i18n message key for looking up translations (e.g. 'registered_voters'). */
  message_key: string;
  /** Number formatter for display. */
  format: (n: number) => string;
}

/** Summary totals across all provinces. */
export interface TotalStats {
  provinces: number;
  constituencies: number;
  registered_voters: number;
  vote_stations: number;
}

/** GeoJSON feature properties after data attachment (province-level). */
export interface EnrichedProperties {
  NAME_1?: string;
  NL_NAME_1?: string;
  ID_1?: number;
  _prov_id: string | null;
  _data: ProvinceData | null;
  _thai_name: string;
  [key: string]: unknown;
}

// ── Raw API response types ────────────────────

/** Raw party record from info_party_overview.json. */
export interface RawPartyOverview {
  id: string;
  party_no: string;
  name: string;
  abbr: string | null;
  color: string;
  logo_url: string;
}

/** Raw candidate record from info_mp_candidate.json. */
export interface RawMpCandidate {
  mp_app_id: string;
  mp_app_no: number;
  mp_app_party_id: number;
  mp_app_name: string;
  image_url: string;
}

/** Candidate result within a constituency from stats_cons.json. */
export interface RawCandidateResult {
  mp_app_id: string;
  mp_app_vote: number;
  mp_app_vote_percent: number;
  mp_app_rank: number;
  party_id: number;
}

/** Party result within a constituency from stats_cons.json. */
export interface RawConsPartyResult {
  party_id: number;
  party_list_vote: number;
  party_cons_votes: number;
  first_mp_app_count: number;
  party_list_vote_percent: number;
  party_cons_votes_percent: number;
}

/** Single constituency from stats_cons.json result_province[]. */
export interface RawStatsConstituency {
  cons_id: string;
  turn_out: number;
  percent_turn_out: number;
  valid_votes: number;
  invalid_votes: number;
  blank_votes: number;
  party_list_turn_out: number;
  party_list_percent_turn_out: number;
  party_list_valid_votes: number;
  party_list_invalid_votes: number;
  party_list_blank_votes: number;
  counted_vote_stations: number;
  percent_count: number;
  pause_report: boolean;
  candidates: RawCandidateResult[];
  result_party: RawConsPartyResult[];
}

/** Province entry from stats_cons.json. */
export interface RawStatsProvince {
  prov_id: string;
  turn_out: number;
  percent_turn_out: number;
  constituencies: RawStatsConstituency[];
  result_party: RawConsPartyResult[];
}

/** Top-level response from stats_cons.json. */
export interface RawStatsCons {
  turn_out: number;
  percent_turn_out: number;
  counted_vote_stations: number;
  percent_count: number;
  pause_report: boolean;
  result_province: RawStatsProvince[];
}

/** Single referendum question result (keyed by question UUID). */
export interface RawReferendumResult {
  yes: number;
  no: number;
  abstained: number;
  percent_yes: number;
  percent_no: number;
  percent_abstained: number;
}

/** Constituency entry from stats_referendum.json. */
export interface RawReferendumConstituency {
  cons_id: string;
  referendum_turn_out: number;
  referendum_percent_turn_out: number;
  referendum_results: Record<string, RawReferendumResult>;
}

/** Province entry from stats_referendum.json. */
export interface RawReferendumProvince {
  prov_id: string;
  constituencies: RawReferendumConstituency[];
}

/** Top-level response from stats_referendum.json. */
export interface RawStatsReferendum {
  referendum_turn_out: number;
  referendum_percent_turn_out: number;
  pause_report: boolean;
  referendum_results: Record<string, RawReferendumResult>;
  result_province: RawReferendumProvince[];
}

// ── Resolved election lookup types ────────────

/** Resolved constituency MP winner data. */
export interface ConsWinnerData {
  candidate_name: string;
  party_name: string;
  party_color: string;
  vote_count: number;
  vote_percent: number;
  /** Total area voting turnout (ผู้มาใช้สิทธิ ส.ส. เขต). */
  turn_out: number;
  /** Winner's party party-list vote % in the same constituency. */
  party_list_vote_percent: number;
}

/** Single party entry in party list results (resolved). */
export interface PartyListResultResolved {
  party_name: string;
  party_color: string;
  votes: number;
  vote_percent: number;
}

/** Resolved party list data for a constituency. */
export interface ConsPartyListData {
  turn_out: number;
  top_parties: PartyListResultResolved[];
}

/** Resolved referendum data for a constituency. */
export interface ConsReferendumData {
  percent_yes: number;
  percent_no: number;
  percent_abstained: number;
}

/** Resolved constituency-level net diff between MP and party list turnout. */
export interface ConsDiffData {
  /** Total MP ballot turnout (ผู้มาใช้สิทธิ ส.ส. เขต). */
  mp_turn_out: number;
  /** MP ballot turnout percentage. */
  mp_percent_turn_out: number;
  /** Total party list ballot turnout (ผู้มาใช้สิทธิ บัญชีรายชื่อ). */
  party_list_turn_out: number;
  /** Party list ballot turnout percentage. */
  party_list_percent_turn_out: number;
  /** mp_turn_out - party_list_turn_out. */
  diff_count: number;
  /** mp_percent_turn_out - party_list_percent_turn_out. */
  diff_percent: number;
}

/** Metric toggle for diff heatmap page. */
export type DiffMetric = "diff_count" | "diff_percent";

/**
 * Ballot forensics data per constituency — invalid/blank/valid vote analysis.
 *
 * @description Exposes hidden data from ECT APIs: invalid votes, blank votes,
 *              valid vote ratios, reporting completeness, and registered voter turnout.
 *              All percentage fields are pre-computed as (value / turnout * 100).
 */
export interface ConsBallotForensicsData {
  /** Number of invalid MP ballot votes. */
  mp_invalid_votes: number;
  /** Invalid MP votes as % of MP turnout. */
  mp_invalid_pct: number;
  /** Number of invalid party list ballot votes. */
  pl_invalid_votes: number;
  /** Invalid PL votes as % of PL turnout. */
  pl_invalid_pct: number;
  /** mp_invalid_pct - pl_invalid_pct (positive = more MP invalids). */
  invalid_diff: number;
  /** Number of blank MP ballot votes. */
  mp_blank_votes: number;
  /** Blank MP votes as % of MP turnout. */
  mp_blank_pct: number;
  /** Number of blank party list ballot votes. */
  pl_blank_votes: number;
  /** Blank PL votes as % of PL turnout. */
  pl_blank_pct: number;
  /** mp_blank_pct - pl_blank_pct (positive = more MP blanks). */
  blank_diff: number;
  /** Number of valid MP ballot votes. */
  mp_valid_votes: number;
  /** Valid MP votes as % of MP turnout. */
  mp_valid_pct: number;
  /** Number of valid party list ballot votes. */
  pl_valid_votes: number;
  /** Valid PL votes as % of PL turnout. */
  pl_valid_pct: number;
  /** mp_valid_pct - pl_valid_pct. */
  valid_diff: number;
  /** Number of stations that have reported results. */
  counted_vote_stations: number;
  /** Total number of vote stations in the constituency. */
  total_vote_stations: number;
  /** Percentage of stations counted (0-100). */
  percent_count: number;
  /** Whether ECT has paused reporting for this constituency. */
  pause_report: boolean;
  /** Registered voters for the constituency. */
  registered_voters: number;
  /** MP turnout as % of registered voters. */
  mp_turnout_of_registered: number;
}

/** Bundle of all election lookups keyed by cons_id. */
export interface ElectionLookups {
  winners: Record<string, ConsWinnerData>;
  party_list: Record<string, ConsPartyListData>;
  referendum: Record<string, ConsReferendumData>;
  diff: Record<string, ConsDiffData>;
  /** Ballot forensics: invalid/blank/valid vote analysis per constituency. */
  forensics: Record<string, ConsBallotForensicsData>;
}

/** GeoJSON feature properties for constituency-level map. */
export interface ConstituencyFeatureProps {
  /** Thai province name from Shapefile P_name. */
  P_name: string;
  /** Constituency number from Shapefile CONS_no. */
  CONS_no: number;
  /** Matched ECT constituency data. */
  _cons_data: ConstituencyData | null;
  /** Display label: "จังหวัด เขต N". */
  _label: string;
  [key: string]: unknown;
}
