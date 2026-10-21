import type { Schemas } from "~/api/client";
import type { MetricResult, SeriesResult } from "~/analysis/types.gen";

/** One metric value as the UI shows it, from either the analysis (MetricResult) or a list's
 *  metrics_summary (MetricBrief). `value: null` is missing data, never a number. */
export interface MetricReading {
  readonly name: string;
  readonly value: number | null;
  readonly unit: string;
  readonly lowConfidence: boolean;
  readonly nullReason: string | null;
  readonly lowConfidenceReason: string | null;
}

export function fromResult(name: string, m: MetricResult): MetricReading {
  return {
    name,
    value: m.value,
    unit: m.unit,
    lowConfidence: m.confidence === "low",
    nullReason: m.value === null ? (m.reason_if_null ?? null) : null,
    lowConfidenceReason: m.confidence === "low" ? (m.reason_low_confidence ?? null) : null,
  };
}

export function fromBrief(name: string, m: Schemas["MetricBrief"]): MetricReading {
  const low = m.confidence === "low";
  return {
    name,
    value: m.value ?? null,
    unit: m.unit,
    lowConfidence: low,
    nullReason: m.value == null ? (m.reason ?? null) : null,
    lowConfidenceReason: m.value != null && low ? (m.reason ?? null) : null,
  };
}

export function isScalar(m: MetricResult | SeriesResult): m is MetricResult {
  return m.kind !== "series";
}
