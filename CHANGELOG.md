# CHANGELOG

## [3.7.0] - 2026-02-13

### Added
- **Party Analysis page** (`/[locale]/party-analysis`) - Anomaly detection dashboard by political party
  - **Total absolute diff bar chart**: Σ|diff_count| per party in winning constituencies, top 15 parties
  - **Average diff bar chart**: diverging bar (green=MP higher, red=PL higher) per party, sorted by avg |diff|
  - **Box plot**: distribution per party (median, Q1/Q3, whiskers, outliers) for parties with ≥3 seats
  - **Scatter plot**: diff_count vs diff_percent per constituency, color by winning party
    - Z-Score based anomaly highlighting (|Z| > 2 = anomaly with white border + larger dot)
    - Normal zone shading (green band for |Z| ≤ 2)
    - Party filter pills with click-to-toggle
    - Hover tooltip: area, party, candidate, diff, z-score
  - **Anomaly summary cards**: per-party anomaly count with rate percentage
  - **Anomaly detail table**: top 50 anomalous constituencies sorted by |Z-Score|, with party, area, candidate, diff, z-score
  - **Party summary table**: all parties with seats, total diff, avg diff, avg %, std dev, anomaly count
- `src/components/party_analysis_client.tsx` - Client component with 4 D3 charts + 2 data tables
- `src/app/[locale]/party-analysis/page.tsx` - Server component reusing existing data pipeline
- `party_analysis` i18n section across all 11 locales (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)
  - 30 translation keys: title, subtitle, chart titles, axis labels, legends, table headers, anomaly labels
- `topbar.party_analysis` nav link with people icon across all 11 locales
- Build passes with 0 errors, all 400 constituencies rendered

## [3.6.6] - 2026-02-13

### Added
- **TopBar: hamburger menu for mobile** (`topbar.tsx`)
  - Desktop (md+): inline pill nav links (unchanged)
  - Mobile (<md): compact bar with brand icon + theme/lang + hamburger button
  - Hamburger opens slide-down panel with full nav links, active state indicators, and settings row
  - Brand text hidden on mobile (icon only), shown on sm+
  - `slideDown` CSS keyframe animation for smooth menu open
  - Close on outside click or backdrop tap
  - Nav link data extracted into reusable `NavLink[]` array (DRY)
  - `mobile_nav_class()` helper for mobile menu item styling with active state

### Changed
- **Responsive layout fixes across all pages**
  - `map_client.tsx`: metric card grids `grid-cols-3` → `grid-cols-2 sm:grid-cols-3`, hero text `text-5xl` → `text-3xl sm:text-5xl`, padding `px-6` → `px-4 sm:px-6`
  - `diff_stats_panel.tsx`: panel hidden on mobile (`hidden md:block`), toggle button hidden on mobile
  - `diff_heatmap_client.tsx`: legend repositioned for mobile (`bottom-4 left-4 sm:bottom-6 sm:left-6`), max-width constrained
  - `diffwinratio_client.tsx`: D3 chart margins reduced on mobile (left: 90→50, right: 50→16), legend mobile-friendly
  - `heatmap_graphs_client.tsx`: content padding `pt-32` → `pt-24 sm:pt-32`, bell curve legend uses `flex-wrap`
  - `party_analysis_client.tsx`: title `text-2xl` → `text-xl sm:text-2xl`, content padding responsive
  - `globals.css`: added `@keyframes slideDown` for mobile menu animation
- Build passes with 0 errors, all 5 routes rendered

## [3.6.5] - 2026-02-13

### Added
- **`party_analysis` i18n section** across all 11 locale files (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)
  - 37 translation keys: title, subtitle, chart labels (total_diff, avg_diff, box, scatter), anomaly detection, summary table, legend
  - `topbar.party_analysis` nav key across all 11 locales
  - Translations: Thai, English, Lao, Vietnamese, Chinese, German, Japanese, Korean, French, Swedish, Indonesian

## [3.6.4] - 2026-02-13

### Added
- **Root page: Winner Diff Piechart** (`map_client.tsx`)
  - Same donut pie chart from heatmap dashboard now shown on root page before hero/metrics
  - Shows winning MPs in areas where |diff_percent| exceeds user-editable threshold
  - Grouped by winning party with party colors, hover effects, percentage labels
  - Threshold slider + number input (0–15%, step 0.1, default 2.5%)
- **Hover area list on pie chart** (`winner_diff_piechart.tsx`)
  - When hovering a party slice or legend item, a scrollable area list appears below
  - Lists all matching constituencies for that party (sorted by |diff%| descending)
  - Each row shows: province name, constituency number, diff percentage
  - Smooth fade-in animation, max height 160px with scroll
- **Extended `WinnerDiffItem` type** with optional area fields: `prov_name_th`, `cons_no`, `cons_id`
  - Both root page and heatmap dashboard pass full area info to the pie chart
  - Backward-compatible: fields are optional
- Build passes with 0 errors, all 400 constituencies rendered

### Fixed
- **TopBar: active page indicator** (`topbar.tsx`)
  - Nav links now highlight with `bg-accent/15 text-accent` when on their corresponding page
  - Brand link shows accent styling when on the home/root page
  - Active state derived from `usePathname()` matching route segments
  - `nav_link_class()` helper builds className with active vs default styling
  - `is_home` flag detects root page for brand link active state

## [3.6.3] - 2026-02-13

### Added
- **Welcome modal on page load** (`map_client.tsx`)
  - Full-screen overlay with `backdrop-blur-md` and dark scrim (`bg-black/60`)
  - Intro text displayed large (`text-2xl md:text-3xl lg:text-4xl`) in white, bold font
  - Election date badge ("8 Feb 2025") in accent-colored pill above text
  - Localized dismiss button with accent background and shadow
  - Fade-out animation (300ms opacity + scale transition) on dismiss
  - Click anywhere on backdrop or button to dismiss
  - `modal_dismiss` i18n key added across all 11 locales

### Changed
- **Bigger inline intro text**: upgraded from `text-sm` to `text-lg md:text-xl font-medium`

## [3.6.2] - 2026-02-13

### Added
- **Winner Party Pie Chart** (`winner_diff_piechart.tsx`)
  - Donut pie showing winning MPs in areas where |diff_percent| exceeds user-editable threshold
  - Default threshold: 2.5%, adjustable via slider + number input (0–15%, step 0.1)
  - Grouped by winning party with party colors, hover effects, percentage labels
  - Scrollable party legend with count and share percentage
- **Normalized Regional Pie Chart** (`region_normalized_piechart.tsx`)
  - Same donut style as existing regional pie, but normalized by population
  - Value = Σ|diff_count| / Σ(registered_voters) per region
  - Shows diff-to-population ratio (%) per sector in center label
  - Legend shows raw ratio, share %, and raw values (diff / population)
- Both charts integrated into heatmap dashboard as new Row 2 (between existing pie/top10 and bell curve)
- 7 new i18n keys (`winner_pie_*`, `normalized_pie_*`) across all 11 locales
- Placeholder `party_analysis_client.tsx` to fix pre-existing build error
- Build passes with 0 errors, all 400 constituencies rendered

## [3.6.1] - 2026-02-13

### Changed
- **DiffWinRatio: X axis now uses total area turnout diff** (`diffwinratio_client.tsx`)
  - X axis changed from winner-party split-ticket gap to `|mp_turn_out − party_list_turn_out|` (total area diff)
  - Removed logarithmic scale, back to linear for straightforward reading
  - Tooltip now shows actual vote counts (not %) for turnout breakdown:
    - MP ballot votes (จำนวนโหวตบัตร ส.ส.เขต)
    - Party list votes (จำนวนโหวตบัตรบัญชีรายชื่อ)
    - Signed diff count with % in parentheses
  - i18n labels updated across all 11 locales to reflect area-level turnout

### Added
- **DiffWinRatio: party filter** (`diffwinratio_client.tsx`)
  - Scrollable horizontal pill bar below sub-bar for filtering by พรรค (winning party)
  - "ทั้งหมด" (All) button shows total constituency count
  - Per-party pills: party color dot + name + seat count
  - Multi-select: click to toggle, active pills filled with party color
  - Chart re-renders with filtered data, scales adjust to visible points
  - `PartyFilter` sub-component with `PartyInfo` type
  - Build passes with 0 errors

## [3.6.0] - 2026-02-13

### Added
- **Heatmap Graphs page** (`/[locale]/heatmap`) - Interactive visualization dashboard
  - **Donut pie chart**: ผลต่างสะสมรวม by 6 Thai regions with hover effects and percentage labels
  - **Top 10 areas**: highest |diff_count| constituencies with area name + winner info (party dot, party name, candidate), scrollable list
  - **Distribution histogram**: bell curve with D3 bins + kernel density estimation overlay
    - Mean (μ) and Median (M) annotation lines with legend
    - Zero reference line for positive/negative diff distinction
  - **Key insights grid**: 12 computed statistics cards with icons
    - Total abs diff, positive/negative/zero counts, mean, median, std dev
    - Highest/lowest diff region, max/min diff, skewness
  - Region color palette: North=green, NE=blue, Central=orange, East=purple, West=yellow, South=red
- `src/components/heatmap_graphs_client.tsx` - Client component with D3 pie, histogram, density curve
- `src/app/[locale]/heatmap/page.tsx` - Server component reusing existing data pipeline
- `graphs` i18n section across all 11 locales (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)
  - 25 translation keys: title, subtitle, pie/top10/bell/insights labels, insight metrics, skew labels
- `topbar.graphs` nav link with bar-chart icon across all 11 locales
- Build passes with 0 errors, all 400 constituencies rendered

## [3.5.8] - 2026-02-13

### Changed
- **Diff-count map: blue→purple color scheme** (`diff_heatmap_client.tsx`, `constants.ts`)
  - Replaced grey 9-step scale with blue-to-purple 9-step gradient
  - Low diff = pale blue (`#e0ecff`), high diff = deep purple (`#7c1dab`)
  - More diff = more solid/saturated color
  - Added `DIFF_COLOR_SCHEME` constant array in `constants.ts`
  - Legend gradient updated to match new blue→purple palette
  - Direction dots (green/red) retained for MP vs party-list indicator
  - Build passes with 0 errors

### Added
- **Root page: absolute/% diff toggle** (`map_client.tsx`, `diff_stats_panel.tsx`)
  - Two pill buttons toggle between "Absolute Count" and "% Diff" display modes
  - Absolute mode (default): hero and cards show `Σ|diff_count|` (raw vote count)
  - % mode: hero and cards show `Σ|diff_count| / avg(mp_turnout, pl_turnout) × 100` (overall % mismatch)
  - `RegionDiffStats` extended with `sum_abs_percent`, `total_mp_turnout`, `total_pl_turnout`
  - `compute_region_stats()` now accumulates turnout totals for % calculation
  - All labels and hero card dynamically switch based on selected mode
- **i18n: 3 new heatmap keys** across all 11 locales
  - `stats_total_pct_diff` — Total % Diff label
  - `stats_mode_absolute` — Absolute Count mode label
  - `stats_mode_percent` — % Diff mode label

## [3.5.7] - 2026-02-12

### Changed
- **Root page: replaced max/min count cards with total diff** (`map_client.tsx`)
  - Removed `stats_max_count` and `stats_min_count` cards from both nationwide and regional grids
  - Each section now shows: mismatch, avg %, max %, min %, total absolute diff (spanning 2 cols)
  - Total diff per region shows Σ|diff_count| for that region in accent color
- **Thai `stats_total_abs_diff` label** improved: "ผลต่างรวมทั้งหมด" → "ผลต่างสะสมรวม (ทุกเขต)"
- **Added intro paragraph** below page header with i18n `stats_intro` key across all 11 locales
  - Thai: "แด่ชาวโลก และ ประเทศที่เจริญ เมื่อวันที่ 8 กุมภา ไทยมีการเลือกตั้ง..."

## [3.5.6] - 2026-02-12

### Added
- **Root page: hero total absolute diff** (`map_client.tsx`)
  - Big prominent number showing Σ|diff_count| across all 400 constituencies
  - e.g. if area A = +5 and area B = -5, total = 10 (both sides counted)
  - Displayed as accent-colored `text-5xl` hero card above nationwide metrics
  - Shows formula label `Σ |diff|` and mismatch fraction
- **`sum_abs_count` field** added to `RegionDiffStats` interface (`diff_stats_panel.tsx`)
  - Accumulated in `compute_region_stats()` loop
- **Nationwide section: enlarged cards** — `rounded-xl p-5 text-2xl` vs regional `rounded-lg p-3 text-sm`
- **i18n: `stats_total_abs_diff` key** across all 11 locales

## [3.5.5] - 2026-02-12

### Changed
- **DiffWinRatio: X axis changed to split-ticket gap** (`diffwinratio_client.tsx`, `data.ts`, `constituency.ts`)
  - X axis now shows `|winner cons vote % − party's party-list vote %|` (absolute value)
  - Previously showed turnout diff (mp_percent_turn_out − party_list_percent_turn_out) which clustered at 0
  - New metric reveals how much voters split-ticket: voted for a candidate but chose a different party list
  - Added `party_list_vote_percent` field to `ConsWinnerData` type
  - Updated `build_winner_lookup()` to capture winner's party's party-list vote % from `cons.result_party[]`
  - Both negative and positive diffs collapse to same side via `Math.abs()` per user request
- **i18n: updated diffwinratio labels across all 11 locales**
  - Added `cons_pct` and `pl_pct` tooltip keys (show breakdown in tooltip)
  - Updated `x_axis`, `title`, `diff_pct` labels to reflect split-ticket gap formula
  - Build passes with 0 errors, all 400 constituencies rendered

## [3.5.4] - 2026-02-12

### Changed
- **Root page: replaced map with inline regional stats** (`map_client.tsx`)
  - Removed ThailandMap, MapTooltip, MapLegend, StatsBar and all map-related state/imports
  - Stats now rendered as full-page inline content (not slide-over panel)
  - Centered `max-w-5xl` layout with nationwide section + 6-region sections separated by dividers
  - 3-column metric card grid per section (mismatch, avg %, max %, min %, max count, min count)
  - Page header shows province/constituency totals
  - TopBar remains as floating navigation overlay

## [3.5.3] - 2026-02-12

### Changed
- **TopBar: removed metric toggle buttons** (ผู้มีสิทธิเลือกตั้ง, หน่วยเลือกตั้ง)
  - Removed `active_metric` and `on_metric_change` props from `TopBarProps`
  - Brand button now always navigates to `/{locale}` (root map)
  - TopBar now shows: brand link + page nav links + separator + theme/lang controls
- **Root map page: added regional stats panel** (same as `/diff-count` slide-over)
  - Shows nationwide + 6-region diff stats (mismatch count, avg %, max/min %, max/min count)
  - 35% right-side panel, always visible

### Refactored
- **Extracted `DiffStatsPanel`** into shared `src/components/diff_stats_panel.tsx`
  - Removed inline definitions from `diff_heatmap_client.tsx`
  - Now imported by both `map_client.tsx` (root) and `diff_heatmap_client.tsx` (diff-count)
  - Includes `compute_region_stats()`, `group_by_region()`, `RegionDiffStats` type

## [3.5.2] - 2026-02-12

### Added
- **Diff percent labels on map constituencies** in `/diff-count` page
  - Each of the 400 constituency areas now displays its `diff_percent` value (e.g. `+0.4%`, `-3.1%`) directly on the map
  - Labels rendered as SVG `<text>` elements at polygon centroids with stroke outline for readability
  - New optional `get_label` prop on `ThailandMap` (backward-compatible)
  - Labels update on metric/theme change via recolor effect
  - Theme-aware: `--map-label` (fill) and `--map-label-stroke` (outline) CSS variables for dark/light modes
  - `get_map_colors()` extended with `label_color` and `label_stroke` fields

## [3.5.1] - 2026-02-12

### Fixed
- **TopBar: brand + metric buttons now navigate to root map** on non-main pages
  - Brand button ("ireadelection69") changed from `<button>` (no handler) to `<a href="/{locale}">`
  - Metric toggle buttons render as `<a href="/{locale}">` links when `on_metric_change` is not provided
  - On the main map page, metric buttons still work as before (toggle metric via callback)
  - Previously these 3 buttons were dead (no click handler) on `/diff-count` and `/diffwinratio`

## [3.5.0] - 2026-02-12

### Added
- **DiffWinRatio scatter-bubble chart page** (`/[locale]/diffwinratio`)
  - X axis: % diff between MP ballot and party list ballot turnout
  - Y axis: % of votes the winner got from total area turnout (vote_count / turn_out)
  - Bubble size: absolute vote count of the winning candidate
  - Bubble color: winning party color
  - Labels on larger bubbles: party name
  - Hover tooltip: province, constituency, party (with color dot), candidate name, votes, win %, diff %
  - Size legend showing bubble scale reference
  - Sub-bar with back link + page title
  - Responsive: re-renders on window resize
  - D3 grid, zero reference line, themed axes
- `src/app/[locale]/diffwinratio/page.tsx` - Server component reusing existing data pipeline
- `src/components/diffwinratio_client.tsx` - Client orchestrator with D3 scatter-bubble chart
- `diffwinratio` i18n keys across all 11 locales (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)
- `topbar.diffwinratio` nav link with scatter icon across all 11 locales

## [3.4.2] - 2026-02-12

### Changed
- **Diff page layout: always-visible stats panel + left-aligned bars**
  - Stats panel now always visible (removed toggle button and slide animation)
  - Removed `is_open`/`on_toggle` props from `DiffStatsPanel`
  - TopBar positioned left (`align="left"` prop) instead of centered on diff page
  - Sub-bar (diff tab toggles) also left-aligned at `left-4`

### Fixed
- **Build error: stale `is_open` reference** in `DiffStatsPanel` console.log after props simplification

## [3.4.1] - 2026-02-12

### Changed
- **Font: Noto Sans Thai applied from root** — moved CSS font variables from `<body>` to `<html>` in layout, and `font-family` declaration from `body` to `:root` in `globals.css` so the font cascades globally from the root element

## [3.4.0] - 2026-02-12

### Added
- **Regional stats slide-over panel** on `/diff-count` page (35% right side)
  - Nationwide mismatch metrics: count/total, avg %, max/min %, max/min absolute count
  - Breakdown by 6 Thai regions (ภาค): North, Northeast, Central, East, West, South
  - Animated slide-in/out transition with toggle button
  - `PROV_ID_TO_REGION` mapping for all 77 provinces in `constants.ts`
  - `REGION_ORDER`, `REGION_NAMES`, `get_diff_dot_colors()` utilities
  - Stats panel i18n keys across all 11 locales
- **Direction indicator dots** on diff map constituency centroids
  - Green dot = MP turnout higher, Red dot = party list turnout higher
  - `get_dot_color` optional prop on `ThailandMap` (backward-compatible)
  - Centroid circles rendered as separate SVG layer above polygons

### Fixed
- **Hydration mismatch** in ThemeProvider: deferred localStorage read to `useEffect`
  - Server and client now both render with `"dark"` default during hydration
  - Layout's inline script still sets correct CSS class pre-hydration (no FOUC)

### Changed
- **Diff map color scheme**: Replaced red→white→blue diverging scale with grey quantize scale (same `COLOR_SCHEME` as root map) + direction dots
- **Tooltip diff colors**: Changed from blue/red to green/red matching dot indicators
- **Legend**: Now shows grey magnitude gradient + dot color explanation (green/red)

## [3.3.0] - 2026-02-12

### Changed
- **Diff page route**: Renamed from `/[locale]/heatmap` to `/[locale]/diff-count`
- **Diff page TopBar**: Now renders the standard TopBar (same as main page) instead of replacing center controls
  - Added separate floating sub-bar below TopBar with diff tab toggle (count/percent) + back link
  - Sub-bar uses same pill design as TopBar with matching blur/shadow
- **Diff data**: Changed from candidate-level diff to constituency-level net turnout
  - `diff_count = cons.turn_out - cons.party_list_turn_out` (total voters, not per-candidate)
  - `diff_percent = cons.percent_turn_out - cons.party_list_percent_turn_out`
  - Simplified `build_diff_lookup()` — no longer needs candidate/party API data
- **Thai topbar text**: Changed heatmap link label from "แผนที่ความร้อน" to "ความต่างบัตร2แบบ"
- **TopBar**: Made `active_metric`/`on_metric_change` optional, added `center_controls` prop for page-level customization (backward-compatible)

## [3.2.1] - 2026-02-12

### Fixed
- **Tooltip: area vote turnout** now shown in ส.ส. เขต (MP Winner) section header
  - Added `turn_out` field to `ConsWinnerData` type
  - `build_winner_lookup()` now captures `cons.turn_out` from raw API data
  - Tooltip header displays "ผู้มาใช้สิทธิ {count}" alongside section title
- **Tooltip: party list turnout** now visible even when no top parties have votes
  - Removed `top_parties.length > 0` guard so turnout always renders when data exists

## [3.2.0] - 2026-02-12

### Added
- **Diff Heatmap Page** (`/[locale]/heatmap`): Split-ticket voting visualization
  - Compares constituency MP (ส.ส. เขต) vs party list (บัญชีรายชื่อ) votes per constituency
  - Diverging color scale: red (MP weaker) → white (neutral) → blue (MP stronger)
  - Tab toggle switches between absolute vote count diff and percentage diff
  - Tooltip shows party name, MP votes, party list votes, and computed difference
  - Diverging legend with min/max labels
  - "Back to map" link for navigation
- `ConsDiffData` interface + `DiffMetric` type in `src/types/constituency.ts`
- `build_diff_lookup()` in `src/lib/data.ts` - computes MP vs party list diff per constituency
- `diff` field added to `ElectionLookups` bundle
- `src/app/[locale]/heatmap/page.tsx` - Server component reusing existing data pipeline
- `src/components/diff_heatmap_client.tsx` - Client orchestrator with DiffTooltip + DiffLegend
- Optional `get_fill_color` prop on `ThailandMap` for custom coloring (backward-compatible)
- `heatmap` i18n keys across all 11 locales (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)
- Heatmap navigation button in topbar (grid icon + localized label) linking to `/[locale]/heatmap`
- `topbar.heatmap` i18n key across all 11 locales

## [3.1.0] - 2026-02-12

### Changed
- **Topbar redesign**: Replaced full-width header with floating pill-shaped toolbar
  - Centered overlay design with `rounded-full`, backdrop blur, and shadow
  - Brand button ("ireadelection69") with ballot box icon on the left
  - Metric toggles (registered voters, vote stations) as icon buttons
  - Share/link button copies current URL to clipboard
  - Vertical separator divider
  - Theme toggle (sun/moon) as icon button
  - Language switcher as flag icon with dropdown popup
  - Share button (with share icon) on the right — copies URL to clipboard
- **Color scheme**: All accent colors changed from indigo to orange
  - Dark theme: `--accent` #6366f1 → #f97316, `--accent-light` #818cf8 → #fb923c
  - Light theme: `--accent` #6366f1 → #f97316, `--accent-light` #4f46e5 → #ea580c
  - `--border-hover` and `--scrollbar-hover` updated to #f97316 in both themes
- Map layout changed from flex-col (header + map) to full-screen map with floating overlays
- Removed old `MetricSelector`, `ThemeToggle`, and `LangSwitcher` imports from `map_client.tsx`

### Added
- `src/components/topbar.tsx` - Floating pill topbar with all controls consolidated
- `topbar` i18n keys across all 11 locales (brand, share)

## [3.0.0] - 2026-02-12

### Added
- Full i18n support via `next-intl` with 11 languages:
  - Thai (th), English (en), Lao (lo), Vietnamese (vi), Chinese (zh)
  - German (de), Japanese (ja), Korean (ko), French (fr), Swedish (sv), Indonesian (id)
- 11 message JSON files in `src/messages/{locale}.json` with ~30 translatable keys each
- Locale-based routing: `src/app/[locale]/layout.tsx` + `src/app/[locale]/page.tsx`
- `src/i18n/config.ts` - locale list, metadata (flag + native name), default locale
- `src/i18n/routing.ts` - next-intl routing configuration
- `src/i18n/request.ts` - server request config for message loading
- `src/middleware.ts` - locale detection + URL prefix routing
- Language switcher dropdown (`src/components/lang_switcher.tsx`) with flag + native name
- Light/dark mode toggle via class-based strategy:
  - `src/lib/theme.tsx` - ThemeProvider context with localStorage persistence
  - `src/components/theme_toggle.tsx` - sun/moon icon toggle button
  - Inline `<script>` in layout for flash-free theme initialization
- Noto Sans Thai + Noto Sans fonts via `next/font/google` (CSS variables)
- CSS theme variables: 16 semantic tokens for bg, text, border, accent, map colors
- Tailwind v4 `@variant dark` class-based dark mode support
- Theme-aware map colors via `get_map_colors()` reading CSS custom properties at runtime

### Changed
- All components use `useTranslations()` for translated text (no hardcoded strings)
- All components use semantic CSS variable classes (e.g. `bg-bg-secondary`, `text-text-primary`)
- `MetricConfig.label`/`label_th` replaced with `message_key` for i18n lookup
- `MAP_CONFIG` no longer contains color values; colors read from CSS variables
- `globals.css` restructured with light/dark theme variable blocks

### Removed
- Old `src/app/layout.tsx` and `src/app/page.tsx` (moved to `[locale]/`)
- Hardcoded `label`/`label_th` from `MetricConfig` type
- Hardcoded hex color values from component classNames

## [2.1.0] - 2026-02-12

### Added
- Live election results on hover tooltip: constituency MP winner, party list votes, referendum
- Fetch 4 new ECT APIs in parallel: stats_cons, stats_referendum, info_mp_candidate, info_party_overview
- `build_election_lookups()` - resilient data pipeline with fallback to empty lookups on failure
- 3 lookup builders: `build_winner_lookup`, `build_party_list_lookup`, `build_referendum_lookup`
- `ElectionLookups` type bundle with `ConsWinnerData`, `ConsPartyListData`, `ConsReferendumData`
- Raw API type interfaces: `RawStatsCons`, `RawStatsReferendum`, `RawMpCandidate`, `RawPartyOverview`
- Tooltip sections: winner (party color + name + votes), party list (top 3 parties), referendum (stacked bar)
- i18n translations for all 7 new tooltip keys across 11 locales (th, en, lo, vi, zh, de, ja, ko, fr, sv, id)

## [2.0.0] - 2026-02-12

### Changed
- Upgraded from province-level (77) to constituency-level (400 เขตเลือกตั้ง) map
- GeoJSON source: KittapatR/Thai-ECT-election-map Shapefile (2569 election)
- Converted 74MB Shapefile → 2.8MB simplified GeoJSON via TopoJSON pipeline
- Matched all 400 constituency polygons to ECT data (0 unmatched)
- Metrics: registered voters + vote stations per constituency
- Tooltip shows: Thai province name, constituency number, zone areas
- Data served from `public/data/constituencies.json` (local, no CORS)

### Added
- `scripts/convert_shapefile.mjs` - Shapefile → TopoJSON → GeoJSON pipeline
- Thai province name → prov_id reverse mapping (THAI_NAME_TO_PROV_ID)
- `ConstituencyData` and `ConstituencyFeatureProps` types

## [1.0.0] - 2026-02-12

### Added
- Next.js 16 app with TypeScript + Tailwind CSS
- D3.js v7 choropleth map of Thailand's 77 provinces
- Data source: ECT constituency API (static-ectreport69.ect.go.th)
- GeoJSON: 77 provinces incl. Bueng Kan (jeepkd github gist)
- Interactive features: hover tooltip, click-to-zoom, metric selector
- Three selectable metrics: constituencies, registered voters, vote stations
- Modular component architecture:
  - `thailand_map.tsx` - D3 SVG map with zoom + pan
  - `map_tooltip.tsx` - Cursor-following province detail tooltip
  - `map_legend.tsx` - Color scale legend
  - `stats_bar.tsx` - Summary statistics overlay
  - `metric_selector.tsx` - Metric toggle buttons
- Province ID mapping: 77 ECT prov_id codes ↔ GeoJSON NAME_1
- Full Thai province name support (PROV_ID_TO_THAI mapping)
- Name alias handling for GeoJSON spelling variants
- Responsive dark theme UI
- Data layer: `lib/data.ts` (fetch, aggregate, enrich)
- Type definitions: `types/constituency.ts`
- Constants: `lib/constants.ts` (URLs, color scheme, metrics)
- API proxy route: `api/proxy/route.ts` (CORS bypass for ECT + GeoJSON)
- Removed standalone `index.html` in favor of Next.js app
