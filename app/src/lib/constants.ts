/**
 * Application constants and configuration.
 *
 * @description Centralized config for data URLs, color schemes,
 *              and province ID-to-name mappings.
 */

import type { MetricConfig, MetricKey } from "@/types/constituency";

/** External data source URLs. */
export const DATA_URLS = {
  /** Province-level GeoJSON (77 provinces incl. Bueng Kan). */
  province_geojson:
    "https://gist.githubusercontent.com/jeepkd/4e31e6a10f8297b9de50c62856927ecf/raw/9899d9f1ca4cd7c5f103a9b2455d9a01f0c8f895/thailand.json",
  /** ECT constituency data API. */
  constituency:
    "https://static-ectreport69.ect.go.th/data/data/refs/info_constituency.json",
  /** Constituency-level GeoJSON (400 เขตเลือกตั้ง, converted from KittapatR Shapefile). */
  constituency_geojson: "/data/constituencies.json",
  /** Live constituency election results (winners + party list). */
  stats_cons:
    "https://stats-ectreport69.ect.go.th/data/records/stats_cons.json",
  /** Live referendum results per constituency. */
  stats_referendum:
    "https://stats-ectreport69.ect.go.th/data/records/stats_referendum.json",
  /** MP candidate info (names + images). */
  info_mp_candidate:
    "https://static-ectreport69.ect.go.th/data/data/refs/info_mp_candidate.json",
  /** Party overview (57 parties: name, color, logo). */
  info_party_overview:
    "https://static-ectreport69.ect.go.th/data/data/refs/info_party_overview.json",
} as const;

/** Map visualization defaults (static values only). */
export const MAP_CONFIG = {
  center_lon: 101.0,
  center_lat: 13.5,
  transition_ms: 350,
  zoom_min: 0.5,
  zoom_max: 12,
  fit_padding: 0.92,
} as const;

/**
 * Read a CSS custom property from :root at runtime.
 *
 * @param name - CSS variable name (e.g. '--map-null').
 * @param fallback - Fallback value if variable is not set.
 * @returns The computed CSS variable value.
 */
export function get_css_var(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/** Theme-aware map colors, read from CSS variables at render time. */
export function get_map_colors() {
  return {
    null_color: get_css_var("--map-null", "#1a1d2e"),
    stroke_color: get_css_var("--map-stroke", "#2d3154"),
    hover_stroke: get_css_var("--hover-stroke", "#fbbf24"),
    /** Label fill for centroid text. */
    label_color: get_css_var("--map-label", "#ffffff"),
    /** Label stroke/outline for readability. */
    label_stroke: get_css_var("--map-label-stroke", "#000000"),
  };
}

/** Grey 9-step color scheme (light grey → dark grey). */
export const COLOR_SCHEME = [
  "#f5f5f5",
  "#e0e0e0",
  "#c6c6c6",
  "#a8a8a8",
  "#8a8a8a",
  "#6b6b6b",
  "#4d4d4d",
  "#333333",
  "#1a1a1a",
] as const;

/**
 * Blue-to-purple 9-step color scheme for diff-count map.
 *
 * @description Low diff → pale blue, high diff → deep purple.
 *              More diff = more solid/saturated color.
 */
export const DIFF_COLOR_SCHEME = [
  "#e0ecff", // very light blue (near zero diff)
  "#b8d4fe", // light blue
  "#8bb8fc", // sky blue
  "#6b9df7", // medium blue
  "#7b7ef0", // blue-violet
  "#8b5fe6", // indigo
  "#9645d9", // violet
  "#9b2fc9", // purple
  "#7c1dab", // deep purple (max diff)
] as const;

/**
 * Direction indicator colors for diff map centroid dots.
 *
 * @description Used to overlay small dots on constituency centroids
 *              showing which ballot type received more votes.
 * @returns Object with positive (green), negative (red), and neutral colors.
 */
export function get_diff_dot_colors() {
  return {
    /** Green: MP turnout > party list turnout. */
    positive: "#22c55e",
    /** Red: MP turnout < party list turnout. */
    negative: "#ef4444",
    /** Grey: no meaningful difference. */
    neutral: "#6b7280",
  };
}

/**
 * Metric display configurations.
 *
 * @description Labels are now i18n keys; use `metrics.{message_key}`
 *              with useTranslations('metrics') to get localized text.
 */
export const METRICS: Record<MetricKey, MetricConfig> = {
  registered_voters: {
    key: "registered_voters",
    message_key: "registered_voters",
    format: (n: number) => n.toLocaleString("en-US"),
  },
  vote_stations: {
    key: "vote_stations",
    message_key: "vote_stations",
    format: (n: number) => n.toLocaleString("en-US"),
  },
};

/**
 * ECT province ID → GeoJSON NAME_1 (English) mapping.
 * Covers all 77 provinces of Thailand.
 */
export const PROV_ID_TO_NAME: Record<string, string> = {
  ACR: "Amnat Charoen",
  ATG: "Ang Thong",
  BKK: "Bangkok Metropolis",
  BKN: "Bueng Kan",
  BRM: "Buri Ram",
  CCO: "Chachoengsao",
  CNT: "Chai Nat",
  CPM: "Chaiyaphum",
  CTI: "Chanthaburi",
  CMI: "Chiang Mai",
  CRI: "Chiang Rai",
  CBI: "Chon Buri",
  CPN: "Chumphon",
  KSN: "Kalasin",
  KPT: "Kamphaeng Phet",
  KRI: "Kanchanaburi",
  KKN: "Khon Kaen",
  KBI: "Krabi",
  LPG: "Lampang",
  LPN: "Lamphun",
  LEI: "Loei",
  LRI: "Lop Buri",
  MSN: "Mae Hong Son",
  MKM: "Maha Sarakham",
  MDH: "Mukdahan",
  NYK: "Nakhon Nayok",
  NPT: "Nakhon Pathom",
  NPM: "Nakhon Phanom",
  NMA: "Nakhon Ratchasima",
  NSN: "Nakhon Sawan",
  NST: "Nakhon Si Thammarat",
  NAN: "Nan",
  NWT: "Narathiwat",
  NBP: "Nong Bua Lamphu",
  NKI: "Nong Khai",
  NBI: "Nonthaburi",
  PTE: "Pathum Thani",
  PTN: "Pattani",
  PNA: "Phang Nga",
  PLG: "Phatthalung",
  PYO: "Phayao",
  PNB: "Phetchabun",
  PBI: "Phetchaburi",
  PCT: "Phichit",
  PLK: "Phitsanulok",
  AYA: "Phra Nakhon Si Ayutthaya",
  PRE: "Phrae",
  PKT: "Phuket",
  PRI: "Prachin Buri",
  PKN: "Prachuap Khiri Khan",
  RNG: "Ranong",
  RBR: "Ratchaburi",
  RYG: "Rayong",
  RET: "Roi Et",
  SKW: "Sa Kaeo",
  SNK: "Sakon Nakhon",
  SPK: "Samut Prakan",
  SKN: "Samut Sakhon",
  SKM: "Samut Songkhram",
  SRI: "Saraburi",
  STN: "Satun",
  SSK: "Si Sa Ket",
  SBR: "Sing Buri",
  SKA: "Songkhla",
  STI: "Sukhothai",
  SPB: "Suphan Buri",
  SNI: "Surat Thani",
  SRN: "Surin",
  TAK: "Tak",
  TRG: "Trang",
  TRT: "Trat",
  UBN: "Ubon Ratchathani",
  UDN: "Udon Thani",
  UTI: "Uthai Thani",
  UTT: "Uttaradit",
  YLA: "Yala",
  YST: "Yasothon",
};

/**
 * ECT province ID → Thai name mapping.
 * Fallback when GeoJSON NL_NAME_1 is unavailable.
 */
export const PROV_ID_TO_THAI: Record<string, string> = {
  ACR: "อำนาจเจริญ",
  ATG: "อ่างทอง",
  BKK: "กรุงเทพมหานคร",
  BKN: "บึงกาฬ",
  BRM: "บุรีรัมย์",
  CCO: "ฉะเชิงเทรา",
  CNT: "ชัยนาท",
  CPM: "ชัยภูมิ",
  CTI: "จันทบุรี",
  CMI: "เชียงใหม่",
  CRI: "เชียงราย",
  CBI: "ชลบุรี",
  CPN: "ชุมพร",
  KSN: "กาฬสินธุ์",
  KPT: "กำแพงเพชร",
  KRI: "กาญจนบุรี",
  KKN: "ขอนแก่น",
  KBI: "กระบี่",
  LPG: "ลำปาง",
  LPN: "ลำพูน",
  LEI: "เลย",
  LRI: "ลพบุรี",
  MSN: "แม่ฮ่องสอน",
  MKM: "มหาสารคาม",
  MDH: "มุกดาหาร",
  NYK: "นครนายก",
  NPT: "นครปฐม",
  NPM: "นครพนม",
  NMA: "นครราชสีมา",
  NSN: "นครสวรรค์",
  NST: "นครศรีธรรมราช",
  NAN: "น่าน",
  NWT: "นราธิวาส",
  NBP: "หนองบัวลำภู",
  NKI: "หนองคาย",
  NBI: "นนทบุรี",
  PTE: "ปทุมธานี",
  PTN: "ปัตตานี",
  PNA: "พังงา",
  PLG: "พัทลุง",
  PYO: "พะเยา",
  PNB: "เพชรบูรณ์",
  PBI: "เพชรบุรี",
  PCT: "พิจิตร",
  PLK: "พิษณุโลก",
  AYA: "พระนครศรีอยุธยา",
  PRE: "แพร่",
  PKT: "ภูเก็ต",
  PRI: "ปราจีนบุรี",
  PKN: "ประจวบคีรีขันธ์",
  RNG: "ระนอง",
  RBR: "ราชบุรี",
  RYG: "ระยอง",
  RET: "ร้อยเอ็ด",
  SKW: "สระแก้ว",
  SNK: "สกลนคร",
  SPK: "สมุทรปราการ",
  SKN: "สมุทรสาคร",
  SKM: "สมุทรสงคราม",
  SRI: "สระบุรี",
  STN: "สตูล",
  SSK: "ศรีสะเกษ",
  SBR: "สิงห์บุรี",
  SKA: "สงขลา",
  STI: "สุโขทัย",
  SPB: "สุพรรณบุรี",
  SNI: "สุราษฎร์ธานี",
  SRN: "สุรินทร์",
  TAK: "ตาก",
  TRG: "ตรัง",
  TRT: "ตราด",
  UBN: "อุบลราชธานี",
  UDN: "อุดรธานี",
  UTI: "อุทัยธานี",
  UTT: "อุตรดิตถ์",
  YLA: "ยะลา",
  YST: "ยโสธร",
};

/** Thai region identifiers. */
export type RegionKey = "north" | "northeast" | "central" | "east" | "west" | "south";

/** Display order for regions. */
export const REGION_ORDER: RegionKey[] = [
  "north", "northeast", "central", "east", "west", "south",
];

/** Thai region names (always Thai geographic names). */
export const REGION_NAMES: Record<RegionKey, string> = {
  north: "ภาคเหนือ",
  northeast: "ภาคตะวันออกเฉียงเหนือ",
  central: "ภาคกลาง",
  east: "ภาคตะวันออก",
  west: "ภาคตะวันตก",
  south: "ภาคใต้",
};

/**
 * ECT province ID → Thai region mapping (standard 6-region classification).
 *
 * @description Based on National Statistical Office of Thailand grouping.
 *              77 provinces mapped to 6 regions.
 */
export const PROV_ID_TO_REGION: Record<string, RegionKey> = {
  /* ── North (9) ── */
  CMI: "north", CRI: "north", LPN: "north", LPG: "north", MSN: "north",
  NAN: "north", PYO: "north", PRE: "north", UTT: "north",
  /* ── Northeast (20) ── */
  KSN: "northeast", KKN: "northeast", CPM: "northeast", NPM: "northeast",
  NMA: "northeast", BRM: "northeast", MKM: "northeast", MDH: "northeast",
  YST: "northeast", RET: "northeast", LEI: "northeast", SSK: "northeast",
  SNK: "northeast", SRN: "northeast", NKI: "northeast", NBP: "northeast",
  ACR: "northeast", UDN: "northeast", UBN: "northeast", BKN: "northeast",
  /* ── Central (22) ── */
  BKK: "central", KPT: "central", CNT: "central", NYK: "central",
  NPT: "central", NSN: "central", NBI: "central", PTE: "central",
  AYA: "central", PCT: "central", PLK: "central", PNB: "central",
  LRI: "central", SPK: "central", SKM: "central", SKN: "central",
  SRI: "central", SBR: "central", STI: "central", SPB: "central",
  ATG: "central", UTI: "central",
  /* ── East (7) ── */
  CTI: "east", CCO: "east", CBI: "east", TRT: "east",
  PRI: "east", RYG: "east", SKW: "east",
  /* ── West (5) ── */
  KRI: "west", TAK: "west", PKN: "west", PBI: "west", RBR: "west",
  /* ── South (14) ── */
  KBI: "south", CPN: "south", TRG: "south", NST: "south",
  NWT: "south", PTN: "south", PNA: "south", PLG: "south",
  PKT: "south", YLA: "south", RNG: "south", SKA: "south",
  STN: "south", SNI: "south",
};

/**
 * GeoJSON NAME_1 variant spellings → prov_id.
 * Handles known discrepancies between GeoJSON and ECT data.
 */
export const NAME_ALIASES: Record<string, string> = {
  phisanulok: "PLK",
  "udorn thani": "UDN",
  sisaket: "SSK",
  suphanburi: "SPB",
  "nong bua lam phu": "NBP",
  phangnga: "PNA",
  "sa kaeo": "SKW",
  "si sa ket": "SSK",
};

/**
 * Thai province name (P_name from Shapefile) → ECT prov_id.
 * Used to match constituency GeoJSON features to ECT data.
 */
export const THAI_NAME_TO_PROV_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PROV_ID_TO_THAI).map(([pid, thai]) => [thai, pid])
);
