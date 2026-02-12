"use client";

/**
 * MapTooltip - Constituency-level tooltip on hover.
 *
 * @description Shows province name, constituency number, zone details,
 *              and metric values for the hovered constituency.
 *              All text is i18n-aware; colors use CSS theme variables.
 */

import { useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import type {
  ConstituencyData,
  MetricKey,
  ElectionLookups,
} from "@/types/constituency";
import { METRICS } from "@/lib/constants";

interface MapTooltipProps {
  /** Constituency data for the hovered feature. */
  data: ConstituencyData | null;
  /** Mouse event for tooltip positioning. */
  mouse_event: MouseEvent | null;
  /** Currently active metric for highlighting. */
  active_metric: MetricKey;
  /** Election result lookups (winners, party list, referendum). */
  election_lookups: ElectionLookups;
}

/**
 * Tooltip component that follows the cursor on constituency hover.
 *
 * @param data - Hovered constituency data or null.
 * @param mouse_event - Mouse event for positioning.
 * @param active_metric - Current metric being displayed.
 * @returns Positioned tooltip div or null when not hovering.
 */
export default function MapTooltip({
  data,
  mouse_event,
  active_metric,
  election_lookups,
}: MapTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t_tooltip = useTranslations("tooltip");
  const t_metrics = useTranslations("metrics");

  /** Position tooltip avoiding viewport edges. */
  useEffect(() => {
    if (!ref.current || !mouse_event) return;
    const tt = ref.current;
    const rect = tt.getBoundingClientRect();
    const margin = 16;
    let x = mouse_event.clientX + margin;
    let y = mouse_event.clientY - margin;

    if (x + rect.width > window.innerWidth - margin) {
      x = mouse_event.clientX - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (y < margin) y = margin;

    tt.style.left = `${x}px`;
    tt.style.top = `${y}px`;
  }, [mouse_event]);

  if (!data || !mouse_event) return null;

  const metric_entries = Object.values(METRICS);
  const cons_id = data.cons_id;
  const winner = cons_id ? election_lookups.winners[cons_id] : null;
  const party_list = cons_id ? election_lookups.party_list[cons_id] : null;
  const referendum = cons_id ? election_lookups.referendum[cons_id] : null;

  return (
    <div
      ref={ref}
      className="fixed pointer-events-none z-[100] min-w-[220px] max-w-[340px] rounded-xl border border-border-primary bg-bg-secondary px-4 py-3.5 shadow-[0_8px_32px_var(--shadow-tooltip)]"
    >
      {/* Constituency header */}
      <div className="text-base font-bold text-text-primary">
        {data.prov_name_th} {t_tooltip("constituency")} {data.cons_no}
      </div>
      <div className="text-xs text-text-muted mb-2">
        {data.prov_name_en} - {t_tooltip("constituency")} {data.cons_no}
      </div>

      <div className="h-px bg-border-primary my-1.5" />

      {/* Metrics */}
      {metric_entries.map((m) => (
        <div
          key={m.key}
          className="flex justify-between items-center py-0.5 text-sm"
        >
          <span className="text-text-secondary">
            {t_metrics(m.message_key)}
          </span>
          <span
            className={`font-semibold ${
              m.key === active_metric
                ? "text-accent-light text-base"
                : "text-text-primary"
            }`}
          >
            {m.format(data[m.key] || 0)}
          </span>
        </div>
      ))}

      {/* Section 1: ส.ส. เขต (Constituency MP Winner) */}
      {winner && (
        <>
          <div className="h-px bg-border-primary my-1.5" />
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-text-secondary font-medium">
              {t_tooltip("mp_winner")}
            </span>
            <span className="text-text-muted">
              {t_tooltip("turn_out")} {winner.turn_out.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: winner.party_color }}
            />
            <span className="text-text-primary font-semibold truncate">
              {winner.candidate_name}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary mt-0.5">
            <span>{winner.party_name}</span>
            <span className="text-text-primary font-medium">
              {winner.vote_count.toLocaleString()} ({winner.vote_percent.toFixed(1)}%)
            </span>
          </div>
        </>
      )}

      {/* Section 2: บัญชีรายชื่อ (Party List) */}
      {party_list && (
        <>
          <div className="h-px bg-border-primary my-1.5" />
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-text-secondary font-medium">
              {t_tooltip("party_list")}
            </span>
            <span className="text-text-muted">
              {t_tooltip("turn_out")} {party_list.turn_out.toLocaleString()}
            </span>
          </div>
          {party_list.top_parties.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-px"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.party_color }}
                />
                <span className="text-text-secondary truncate">{p.party_name}</span>
              </div>
              <span className="text-text-primary font-medium ml-2 shrink-0">
                {p.votes.toLocaleString()} ({p.vote_percent.toFixed(1)}%)
              </span>
            </div>
          ))}
        </>
      )}

      {/* Section 3: ลงประชามติ (Referendum) */}
      {referendum && (
        <>
          <div className="h-px bg-border-primary my-1.5" />
          <div className="text-[11px] text-text-secondary font-medium mb-1">
            {t_tooltip("referendum")}
          </div>
          {/* Stacked horizontal bar */}
          <div className="flex w-full h-2 rounded-full overflow-hidden mb-1">
            <div
              className="h-full"
              style={{
                width: `${referendum.percent_yes}%`,
                backgroundColor: "#22c55e",
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${referendum.percent_no}%`,
                backgroundColor: "#ef4444",
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${referendum.percent_abstained}%`,
                backgroundColor: "#6b7280",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[#22c55e]">
              {t_tooltip("ref_yes")} {referendum.percent_yes.toFixed(1)}%
            </span>
            <span className="text-[#ef4444]">
              {t_tooltip("ref_no")} {referendum.percent_no.toFixed(1)}%
            </span>
            <span className="text-[#6b7280]">
              {t_tooltip("ref_abstain")} {referendum.percent_abstained.toFixed(1)}%
            </span>
          </div>
        </>
      )}

      {/* Zone areas */}
      {data.zone && data.zone.length > 0 && (
        <>
          <div className="h-px bg-border-primary my-1.5" />
          <div className="text-[11px] text-text-muted max-h-[120px] overflow-y-auto leading-relaxed">
            <div className="text-text-secondary font-medium mb-0.5">
              {t_tooltip("areas")}
            </div>
            {data.zone.slice(0, 6).map((z, i) => (
              <div key={i}>{z}</div>
            ))}
            {data.zone.length > 6 && (
              <div className="text-accent-light">
                {t_tooltip("more_areas", { count: data.zone.length - 6 })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
