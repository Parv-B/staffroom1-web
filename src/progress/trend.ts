// One measure across a teacher's analysed lectures, as a line: one point per lecture in upload
// order. Pure, so the honesty rules are unit-tested:
// - a missing value (N/A) or a measure that wasn't computed is a gap: the line stops before it
//   and starts again after it, never drawn through it, never dropped to zero;
// - low-confidence values are their own point state, with the reason;
// - the vertical axis always starts at 0 (every measure here is a count, a duration, a share
//   or a rate) and ends at a round number at or above the largest value (100% for shares);
// - nothing is fitted, averaged, forecast or compared.
import type { LectureSummary } from "~/lectures/vocab";
import { lectureTitle } from "~/lectures/vocab";
import { metricValue } from "~/lib/format";
import { fromBrief } from "~/metrics/reading";

export type TrendState = "value" | "low-confidence" | "na" | "not-computed";

export interface TrendPoint {
  /** Position along the lecture axis, 0-based, oldest first. */
  readonly slot: number;
  readonly lectureId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly state: TrendState;
  /** Null exactly when state is "na" or "not-computed". */
  readonly value: number | null;
  /** The value as the table shows it (null when there is none). */
  readonly text: string | null;
  /** Why it's N/A or low confidence (null otherwise). */
  readonly reason: string | null;
}

export interface TrendTick {
  readonly value: number; // in the measure's own unit
  readonly label: string;
}

export interface TrendAxis {
  readonly max: number; // the axis runs from 0 to max, in the measure's own unit
  readonly ticks: readonly TrendTick[];
  /** The unit the tick labels are in, written out ("per cent", "minutes", ...). */
  readonly unitLabel: string;
}

export interface Trend {
  readonly metric: string;
  readonly unit: string | null;
  readonly points: readonly TrendPoint[];
  /** Runs of consecutive plotted points; each run is drawn as one line (a run of one is a lone point). */
  readonly runs: readonly (readonly TrendPoint[])[];
  /** Null when no lecture has a value for this measure (nothing to plot). */
  readonly axis: TrendAxis | null;
  readonly counts: { readonly plotted: number; readonly lowConfidence: number; readonly na: number; readonly notComputed: number };
}

const NO_REASON = "No reason was recorded.";

/** Analysed lectures, oldest first: the same order and set as the table. */
export function analysedInOrder(lectures: readonly LectureSummary[]): LectureSummary[] {
  return lectures.filter((l) => l.status === "done").sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function buildTrend(lectures: readonly LectureSummary[], metric: string): Trend {
  const analysed = analysedInOrder(lectures);
  const unit = analysed.map((l) => l.metrics_summary?.[metric]?.unit).find((u): u is string => typeof u === "string") ?? null;
  const points: TrendPoint[] = analysed.map((l, slot) => {
    const base = { slot, lectureId: l.lecture_id, title: lectureTitle(l.metadata), createdAt: l.created_at };
    const brief = l.metrics_summary?.[metric];
    if (!brief) return { ...base, state: "not-computed", value: null, text: null, reason: "This measure wasn't computed for this lecture." };
    const r = fromBrief(metric, brief);
    if (r.value === null) return { ...base, state: "na", value: null, text: null, reason: r.nullReason ?? NO_REASON };
    const text = metricValue(r.value, r.unit);
    if (r.lowConfidence) return { ...base, state: "low-confidence", value: r.value, text, reason: r.lowConfidenceReason ?? NO_REASON };
    return { ...base, state: "value", value: r.value, text, reason: null };
  });

  const runs: TrendPoint[][] = [];
  let current: TrendPoint[] | null = null;
  for (const p of points) {
    if (p.value === null) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      runs.push(current);
    }
    current.push(p);
  }

  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  return {
    metric,
    unit,
    points,
    runs,
    axis: values.length > 0 ? axisFor(unit ?? "", Math.max(...values)) : null,
    counts: {
      plotted: values.length,
      lowConfidence: points.filter((p) => p.state === "low-confidence").length,
      na: points.filter((p) => p.state === "na").length,
      notComputed: points.filter((p) => p.state === "not-computed").length,
    },
  };
}

/** A round step giving about four intervals up to `max` (at least `minStep`). */
export function niceStep(max: number, minStep = 0): number {
  const rough = Math.max(max / 4, Number.EPSILON);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= rough) ?? 10 * mag;
  return Math.max(step, minStep);
}

function ticksUpTo(max: number, step: number, label: (v: number) => string): { max: number; ticks: TrendTick[] } {
  const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  const ticks: TrendTick[] = [];
  for (let k = 0; k * step <= top + 1e-9; k++) ticks.push({ value: k * step, label: label(k * step) });
  return { max: top, ticks };
}

const trim = (v: number) => (Number.isInteger(v) ? v.toString() : Number(v.toFixed(2)).toString());

export function axisFor(unit: string, maxValue: number): TrendAxis {
  switch (unit) {
    case "fraction":
      // Shares always get the whole 0-100% range, so a small change can't look large.
      return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1].map((v) => ({ value: v, label: `${(v * 100).toString()}%` })), unitLabel: "per cent" };
    case "s": {
      if (maxValue >= 120) {
        const stepMin = niceStep(maxValue / 60, 1);
        return { ...ticksUpTo(maxValue, stepMin * 60, (v) => trim(v / 60)), unitLabel: "minutes" };
      }
      return { ...ticksUpTo(maxValue, niceStep(maxValue), trim), unitLabel: "seconds" };
    }
    case "count":
    {
      const step = niceStep(maxValue, 1);
      return { ...ticksUpTo(maxValue, Number.isInteger(step) ? step : 5, trim), unitLabel: "a count" };
    }
    case "words/min":
      return { ...ticksUpTo(maxValue, niceStep(maxValue, 1), trim), unitLabel: "words a minute" };
    default:
      return { ...ticksUpTo(maxValue, niceStep(maxValue), trim), unitLabel: unit };
  }
}

/** The axis range in words, e.g. "0 to 100%", "0 to 60 minutes", "0 to 40 (a count)". */
export function rangeText(axis: TrendAxis): string {
  const top = axis.ticks[axis.ticks.length - 1]?.label ?? "0";
  if (axis.unitLabel === "per cent") return `0 to ${top}`;
  if (axis.unitLabel === "a count") return `0 to ${top} (a count)`;
  return `0 to ${top} ${axis.unitLabel}`;
}
