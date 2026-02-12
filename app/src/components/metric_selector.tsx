"use client";

/**
 * MetricSelector - Toggle buttons for switching the active map metric.
 *
 * @description Allows the user to choose between registered voters
 *              or vote stations as the color variable. i18n-aware.
 */

import { useTranslations } from "next-intl";
import type { MetricKey } from "@/types/constituency";
import { METRICS } from "@/lib/constants";

interface MetricSelectorProps {
  /** Currently active metric key. */
  active: MetricKey;
  /** Callback when user selects a different metric. */
  on_change: (metric: MetricKey) => void;
}

/**
 * Metric toggle button group.
 *
 * @param active - Currently selected metric.
 * @param on_change - Handler for metric change.
 * @returns Button group with translated metric labels.
 */
export default function MetricSelector({
  active,
  on_change,
}: MetricSelectorProps) {
  const t_controls = useTranslations("controls");
  const t_metrics = useTranslations("metrics");
  const items = Object.values(METRICS);

  console.log(`[metric_selector] Rendering, active: ${active}`);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="text-xs text-text-secondary font-medium">
        {t_controls("color_by")}
      </label>
      {items.map((m) => (
        <button
          key={m.key}
          onClick={() => on_change(m.key)}
          className={`px-3.5 py-1.5 rounded-md text-xs border transition-all cursor-pointer ${
            active === m.key
              ? "bg-accent border-accent text-white font-semibold"
              : "bg-transparent border-border-primary text-text-secondary hover:border-accent hover:text-text-primary"
          }`}
        >
          {t_metrics(m.message_key)}
        </button>
      ))}
    </div>
  );
}
