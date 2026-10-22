// Pure helpers for the centre summary (/centre). The API sorts teachers alphabetically and
// computes every number; this file only decides how each cell reads. It never sorts, ranks or
// combines teachers, and never turns a missing value into a number.
import type { Category } from "~/analysis/types.gen";
import type { Schemas } from "~/api/client";
import { metricValue } from "~/lib/format";

export type OrgSummary = Schemas["OrgSummaryOut"];
export type GroupSummary = Schemas["GroupSummary"];
export type TeacherGroup = Schemas["TeacherGroup"];
export type MetricAggregate = Schemas["MetricAggregate"];

export type MetricCell =
  | { kind: "value"; median: string; range: string | null; n: number }
  | { kind: "na"; reason: string };

/** Rule 1 for aggregates: a group with no values shows N/A and why, never 0. */
export function metricCell(agg: MetricAggregate | undefined, doneLectures: number): MetricCell {
  if (!agg) return { kind: "na", reason: "This measure isn't in the summary." };
  if (agg.median === null || agg.n_lectures_with_value === 0) {
    if (doneLectures === 0) return { kind: "na", reason: "No finished lectures in this period." };
    if (agg.n_null > 0) return { kind: "na", reason: `Missing in ${countOf(agg.n_null, "lecture")}: ${sentence(agg.most_common_null_reason ?? "no reason was recorded")}` };
    if (agg.n_not_computed > 0) return { kind: "na", reason: `Not computed yet for ${countOf(agg.n_not_computed, "lecture")}.` };
    return { kind: "na", reason: "No lecture has a value for this measure." };
  }
  const unit = agg.unit ?? "";
  const range = agg.p25 !== null && agg.p75 !== null && agg.n_lectures_with_value > 1 ? `${metricValue(agg.p25, unit)} to ${metricValue(agg.p75, unit)}` : null;
  return { kind: "value", median: metricValue(agg.median, unit), range, n: agg.n_lectures_with_value };
}

/** Ends a reason with exactly one full stop. */
export function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function countOf(n: number, noun: string): string {
  return `${n.toString()} ${noun}${n === 1 ? "" : "s"}`;
}

export type FindingCell =
  | { kind: "not-released" }
  | { kind: "not-checked" }
  | { kind: "count"; n: number; lectures: number; bySeverity: string | null };

const SEVERITIES = ["important", "moderate", "minor", "info"] as const;

/** Rule 6 for aggregates: a category the centre hasn't released, or that none of the group's
 *  lectures was checked for, is never a zero. */
export function findingCell(g: GroupSummary, c: Category, released: readonly string[], worked: boolean): FindingCell {
  if (!released.includes(c)) return { kind: "not-released" };
  const lectures = g.findings_n_lectures[c] ?? 0;
  if (lectures === 0) return { kind: "not-checked" };
  const bySev = g.findings[c] ?? {};
  const n = Object.values(bySev).reduce((a, b) => a + b, 0);
  const parts = worked ? [] : SEVERITIES.filter((s) => (bySev[s] ?? 0) > 0).map((s) => `${(bySev[s] ?? 0).toString()} ${s === "info" ? "for information" : s}`);
  return { kind: "count", n, lectures, bySeverity: parts.length > 1 ? parts.join(", ") : null };
}

/** Lectures still to finish: waiting for the upload, queued or running. */
export function inProgress(g: GroupSummary): number {
  const s = g.lectures_by_status;
  return (s.awaiting_upload ?? 0) + (s.queued ?? 0) + (s.running ?? 0);
}

export interface SummaryRange {
  from?: string;
  to?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function parseRange(s: Record<string, unknown>): SummaryRange {
  return {
    ...(typeof s.from === "string" && ISO_DATE.test(s.from) ? { from: s.from } : {}),
    ...(typeof s.to === "string" && ISO_DATE.test(s.to) ? { to: s.to } : {}),
  };
}

export type GroupBy = OrgSummary["group_by"];
export type MetadataGroup = Schemas["MetadataGroup"];
export type Bucket = "week" | "month";

/** What narrows the centre's lectures (besides the dates): passed straight to the API, which
 *  normalises subject and grade spellings. */
export interface CentreFilters {
  subject?: string;
  grade?: string;
  teacher?: string;
}

const GROUP_BYS: readonly GroupBy[] = ["teacher", "subject", "grade"];
const SAFE = /^[\p{L}\p{N} .&'()_-]{1,100}$/u;

export function parseGroupBy(v: unknown): GroupBy {
  return GROUP_BYS.find((g) => g === v) ?? "teacher";
}

export function parseBucket(v: unknown): Bucket {
  return v === "month" ? "month" : "week";
}

export function parseFilters(s: Record<string, unknown>): CentreFilters {
  const pick = (v: unknown) => (typeof v === "string" && SAFE.test(v) ? v : undefined);
  const subject = pick(s.subject);
  const grade = pick(s.grade);
  const teacher = typeof s.teacher === "string" && /^[A-Za-z0-9_-]{1,36}$/.test(s.teacher) ? s.teacher : undefined;
  return { ...(subject ? { subject } : {}), ...(grade ? { grade } : {}), ...(teacher ? { teacher } : {}) };
}

/** A row of the switched tables: the whole centre first, then the API's groups in the API's
 *  order (alphabetical teachers or subjects, numeric grades). Never re-sorted here. */
export type SummaryRow =
  | { kind: "org"; key: string; label: string; g: GroupSummary }
  | { kind: "teacher"; key: string; label: string; g: GroupSummary; teacherId: string; active: boolean }
  | { kind: "subject" | "grade"; key: string; label: string; g: GroupSummary; value: string | null };

export function summaryRows(s: OrgSummary): SummaryRow[] {
  const org: SummaryRow = { kind: "org", key: "org", label: "Whole centre", g: s.org };
  if (s.group_by !== "subject" && s.group_by !== "grade") {
    return [org, ...s.teachers.map((t): SummaryRow => ({ kind: "teacher", key: t.teacher_user_id, label: t.display_name ?? "Unnamed teacher", g: t, teacherId: t.teacher_user_id, active: t.active }))];
  }
  const kind = s.group_by;
  return [
    org,
    ...s.groups.map((g): SummaryRow => ({ kind, key: `${kind}:${g.key ?? "none"}`, label: kind === "grade" && g.key !== null ? `Grade ${g.label}` : g.label, g, value: g.key })),
  ];
}

/** The first column's heading and the tables' captions for a grouping. */
export const GROUP_NOUN: Readonly<Record<GroupBy, string>> = { teacher: "Teacher", subject: "Subject", grade: "Grade" };

/** The filters in words, e.g. "Mathematics, grade 10, one teacher". */
export function filtersText(f: CentreFilters, teacherName: string | null): string | null {
  const parts = [f.subject ?? null, f.grade ? `grade ${f.grade}` : null, f.teacher ? (teacherName ?? "one teacher") : null].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
