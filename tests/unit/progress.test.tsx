import { describe, expect, it } from "vitest";
import type { LectureSummary } from "~/lectures/vocab";
import { buildProgress } from "~/progress/table";

function lecture(id: string, created: string, metrics: LectureSummary["metrics_summary"], status: LectureSummary["status"] = "done"): LectureSummary {
  return {
    lecture_id: id,
    org_id: "o",
    teacher_user_id: "t",
    analysis_available: status === "done",
    total_cost_usd: 0,
    total_seconds: 0,
    status,
    metadata: { board: "CBSE", grade: "10", subject: "Mathematics", chapter: `Chapter ${id}`, class_type: "online" },
    shared_with_owner: false,
    findings_summary: {},
    metrics_summary: metrics,
    created_at: created,
    updated_at: created,
  };
}

describe("teacher progress: per-lecture values only (rules 1, 2, 3)", () => {
  const lectures = [
    lecture("b", "2026-10-20T00:00:00Z", {
      wait_time_median_s: { value: null, unit: "s", confidence: "high", reason: "No questions were asked." },
      student_talk_share: { value: 0, unit: "fraction", confidence: "high", reason: null },
    }),
    lecture("a", "2026-10-01T00:00:00Z", {
      wait_time_median_s: { value: 1.3, unit: "s", confidence: "low", reason: "Audio only." },
      student_talk_share: { value: 0.1, unit: "fraction", confidence: "low", reason: "Audio only." },
    }),
    lecture("c", "2026-10-21T00:00:00Z", null, "running"),
    lecture("d", "2026-10-22T00:00:00Z", null),
  ];
  const { rows, notes } = buildProgress(lectures, ["wait_time_median_s", "student_talk_share"]);

  it("lists analysed lectures oldest first and leaves the rest out", () => {
    expect(rows.map((r) => r.lecture.lecture_id)).toEqual(["a", "b", "d"]);
  });

  it("shows a null as N/A with a numbered reason, never 0, and a real 0 as 0%", () => {
    expect(rows[1]?.cells.wait_time_median_s).toEqual({ kind: "na", note: 2 });
    expect(rows[1]?.cells.student_talk_share).toEqual({ kind: "value", text: "0%", lowConfidence: false });
    expect(notes.find((n) => n.n === 2)).toEqual({ n: 2, kind: "missing", text: "No questions were asked." });
  });

  it("badges low confidence with its reason; identical reasons share one note", () => {
    expect(rows[0]?.cells.wait_time_median_s).toEqual({ kind: "value", text: "1.3 s", lowConfidence: true, note: 1 });
    expect(rows[0]?.cells.student_talk_share).toMatchObject({ lowConfidence: true, note: 1 });
    expect(notes.filter((n) => n.kind === "low-confidence")).toHaveLength(1);
  });

  it("says when a lecture has no stored measures instead of guessing", () => {
    expect(rows[2]?.cells.wait_time_median_s).toEqual({ kind: "not-computed" });
  });

  it("adds no totals, averages or summary rows", () => {
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0]?.cells ?? {})).toEqual(["wait_time_median_s", "student_talk_share"]);
  });
});
