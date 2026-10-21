// A teacher's own measures across their analysed lectures: one row per lecture, oldest first,
// each value exactly as the lecture's report gave it. Nothing is averaged, totalled, compared
// or labelled as better or worse. Missing and low-confidence values keep their reasons, as
// numbered notes under the table (identical reasons share one note).
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import type { LectureSummary } from "~/lectures/vocab";
import { metricValue } from "~/lib/format";
import { fromBrief } from "~/metrics/reading";

/** The same eight measures as the centre summary. */
export const PROGRESS_METRICS = [
  "student_talk_share",
  "teacher_talk_time_s",
  "longest_teacher_monologue_s",
  "teacher_wpm",
  "teacher_question_count",
  "open_question_share",
  "wait_time_median_s",
  "student_turn_count",
] as const;

export type ProgressCell =
  | { kind: "value"; text: string; lowConfidence: false }
  | { kind: "value"; text: string; lowConfidence: true; note: number }
  | { kind: "na"; note: number }
  | { kind: "not-computed" };

export interface ProgressRow {
  lecture: LectureSummary;
  cells: Record<string, ProgressCell>;
}

export interface ProgressNote {
  n: number;
  kind: "missing" | "low-confidence";
  text: string;
}

const NO_REASON = "No reason was recorded.";

export function buildProgress(lectures: readonly LectureSummary[], metrics: readonly string[] = PROGRESS_METRICS): { rows: ProgressRow[]; notes: ProgressNote[] } {
  const notes: ProgressNote[] = [];
  const noteFor = (kind: ProgressNote["kind"], text: string): number => {
    const found = notes.find((x) => x.kind === kind && x.text === text);
    if (found) return found.n;
    const n = notes.length + 1;
    notes.push({ n, kind, text });
    return n;
  };
  const done = lectures.filter((l) => l.status === "done").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rows = done.map((lecture) => {
    const cells: Record<string, ProgressCell> = {};
    for (const m of metrics) {
      const brief = lecture.metrics_summary?.[m];
      if (!brief) {
        cells[m] = { kind: "not-computed" };
        continue;
      }
      const r = fromBrief(m, brief);
      if (r.value === null) cells[m] = { kind: "na", note: noteFor("missing", r.nullReason ?? NO_REASON) };
      else if (r.lowConfidence) cells[m] = { kind: "value", text: metricValue(r.value, r.unit), lowConfidence: true, note: noteFor("low-confidence", r.lowConfidenceReason ?? NO_REASON) };
      else cells[m] = { kind: "value", text: metricValue(r.value, r.unit), lowConfidence: false };
    }
    return { lecture, cells };
  });
  return { rows, notes };
}

const PAGE = 100;

/** Every lecture of one teacher the viewer can see (the API scopes it), all pages. */
export const teacherLecturesQuery = (teacherUserId: string | null) =>
  queryOptions({
    queryKey: ["lectures", "progress", teacherUserId],
    queryFn: async () => {
      const out: LectureSummary[] = [];
      for (let offset = 0; offset < 5000; offset += PAGE) {
        const page = await unwrap(api.GET("/lectures", { params: { query: { limit: PAGE, offset, ...(teacherUserId ? { teacher_user_id: teacherUserId } : {}) } } }));
        out.push(...page.items);
        if (out.length >= page.total || page.items.length === 0) break;
      }
      return out;
    },
    staleTime: 60_000,
  });

export function useTeacherLectures(teacherUserId: string | null, enabled = true) {
  return useQuery({ ...teacherLecturesQuery(teacherUserId), enabled });
}
