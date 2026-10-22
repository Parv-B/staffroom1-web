// The centre's measures per week or month (GET /org/trend), as points for a line chart. Pure,
// so the honesty rules are unit-tested:
// - every bucket the API returns is a slot on the time axis, in order, evenly spaced (buckets
//   are equal calendar steps); nothing is re-sorted, merged, smoothed or fitted;
// - a bucket with no lectures, or with lectures but no value for the measure, is a gap: the
//   line stops before it and starts after it, never drawn through it, never dropped to zero;
// - a bucket resting on one or two values is marked "few" and carries its n;
// - a bucket where any value is low confidence is marked, with how many of how many;
// - the vertical axis starts at 0 and reaches the largest p75 (so the band fits), using the
//   same axis rules as the teacher's progress charts.
import type { Schemas } from "~/api/client";
import { metricValue } from "~/lib/format";
import { axisFor, type TrendAxis } from "~/progress/trend";
import { countOf, sentence } from "./summary";

export type OrgTrend = Schemas["OrgTrendOut"];
export type TrendBucket = Schemas["TrendBucket"];
export type BucketSize = OrgTrend["bucket"];

/** At most this many values: the point is marked as resting on few lectures. */
export const FEW = 2;

export type BucketState = "value" | "no-lectures" | "na";

export interface BucketPoint {
  readonly slot: number;
  readonly start: string;
  readonly end: string;
  readonly partial: boolean;
  readonly state: BucketState;
  readonly median: number | null;
  readonly p25: number | null;
  readonly p75: number | null;
  /** Lectures with a value for this measure (the n of the median). */
  readonly n: number;
  readonly nLectures: number;
  readonly lowConfidence: number;
  /** One or two values only. */
  readonly few: boolean;
  /** Texts as the table shows them (null when there is no value). */
  readonly medianText: string | null;
  readonly rangeText: string | null;
  /** Why there is no value (null when there is one). */
  readonly reason: string | null;
}

export interface CentreTrend {
  readonly metric: string;
  readonly bucket: BucketSize;
  readonly unit: string | null;
  readonly points: readonly BucketPoint[];
  readonly runs: readonly (readonly BucketPoint[])[];
  readonly axis: TrendAxis | null;
  readonly counts: { readonly buckets: number; readonly plotted: number; readonly few: number; readonly lowConfidence: number; readonly gaps: number };
}

export function bucketPoint(b: TrendBucket, metric: string, slot: number): BucketPoint {
  const agg = b.metrics[metric];
  const unit = agg?.unit ?? "";
  const base = { slot, start: b.start, end: b.end, partial: b.partial, nLectures: b.n_lectures };
  const none = { median: null, p25: null, p75: null, n: 0, lowConfidence: 0, few: false, medianText: null, rangeText: null } as const;
  if (b.n_lectures === 0) return { ...base, ...none, state: "no-lectures", reason: "No lectures were uploaded in this period." };
  if (!agg || agg.median === null || agg.n_lectures_with_value === 0) {
    let reason: string;
    if (b.n_done === 0) reason = `None of the ${countOf(b.n_lectures, "lecture")} has finished processing.`;
    else if (agg && agg.n_null > 0) reason = `Missing in ${countOf(agg.n_null, "lecture")}: ${sentence(agg.most_common_null_reason ?? "no reason was recorded")}`;
    else reason = "This measure wasn't computed for these lectures.";
    return { ...base, ...none, state: "na", reason };
  }
  const n = agg.n_lectures_with_value;
  return {
    ...base,
    state: "value",
    median: agg.median,
    p25: agg.p25,
    p75: agg.p75,
    n,
    lowConfidence: agg.n_low_confidence,
    few: n <= FEW,
    medianText: metricValue(agg.median, unit),
    rangeText: n > 1 && agg.p25 !== null && agg.p75 !== null ? `${metricValue(agg.p25, unit)} to ${metricValue(agg.p75, unit)}` : null,
    reason: null,
  };
}

export function buildCentreTrend(t: OrgTrend, metric: string): CentreTrend {
  const points = t.buckets.map((b, i) => bucketPoint(b, metric, i));
  const runs: BucketPoint[][] = [];
  let current: BucketPoint[] | null = null;
  for (const p of points) {
    if (p.median === null) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      runs.push(current);
    }
    current.push(p);
  }
  const unit = t.buckets.map((b) => b.metrics[metric]?.unit).find((u): u is string => typeof u === "string") ?? null;
  const tops = points.flatMap((p) => (p.median === null ? [] : [Math.max(p.median, p.p75 ?? p.median)]));
  const plotted = points.filter((p) => p.state === "value");
  return {
    metric,
    bucket: t.bucket,
    unit,
    points,
    runs,
    axis: tops.length > 0 ? axisFor(unit ?? "", Math.max(...tops)) : null,
    counts: {
      buckets: points.length,
      plotted: plotted.length,
      few: plotted.filter((p) => p.few).length,
      lowConfidence: plotted.filter((p) => p.lowConfidence > 0).length,
      gaps: points.length - plotted.length,
    },
  };
}

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Short axis label: "19 Oct" for a week (its Monday), "Oct 2026" for a month. */
export function bucketTick(p: Pick<BucketPoint, "start">, bucket: BucketSize): string {
  return bucket === "week" ? dayMonth.format(date(p.start)) : monthYear.format(date(p.start));
}

/** "Week of 19 Oct 2026" or "October 2026"; partial buckets say so. */
export function bucketName(p: Pick<BucketPoint, "start" | "end" | "partial">, bucket: BucketSize): string {
  const name = bucket === "week" ? `Week of ${fullDay.format(date(p.start))}` : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date(p.start));
  return p.partial ? `${name} (part of it, within the chosen dates)` : name;
}

/** One sentence per point, for its accessible name and tooltip. */
export function describeBucket(p: BucketPoint, bucket: BucketSize): string {
  const when = bucketName(p, bucket);
  if (p.state !== "value") return `${when}: ${p.state === "no-lectures" ? "no lectures" : "N/A"}. ${p.reason ?? ""}`;
  const parts = [`${when}: median ${p.medianText ?? ""}`];
  if (p.rangeText) parts.push(`middle half ${p.rangeText}`);
  parts.push(p.few ? `only ${countOf(p.n, "lecture")} with a value` : `${countOf(p.n, "lecture")} with a value`);
  if (p.lowConfidence > 0) parts.push(`${p.lowConfidence.toString()} of ${p.n.toString()} low confidence`);
  return `${parts.join(", ")}.`;
}

/** The chart in words (also its accessible description): counts only, no direction. */
export function trendSummary(t: CentreTrend): string {
  const unit = t.bucket === "week" ? ["week", "weeks"] : ["month", "months"];
  const one = (n: number, w: readonly string[]) => `${n.toString()} ${n === 1 ? (w[0] ?? "") : (w[1] ?? "")}`;
  const parts = [`${one(t.counts.buckets, unit)}: ${one(t.counts.plotted, ["has a value", "have a value"])}`];
  if (t.counts.few > 0) parts.push(`${t.counts.few.toString()} of them from only one or two lectures (marked n=1 or n=2)`);
  if (t.counts.lowConfidence > 0) parts.push(`${t.counts.lowConfidence.toString()} include low-confidence values (hollow markers)`);
  if (t.counts.gaps > 0) parts.push(`${t.counts.gaps.toString()} without a value, shown as ${t.counts.gaps === 1 ? "a break" : "breaks"} in the line`);
  return `${parts.join("; ")}. Exact values are in the table below.`;
}
