import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LectureDetail } from "~/lectures/detail";
import { StatusView, estimateText, stageRows } from "~/lectures/StatusView";

const NOW = Date.parse("2026-10-21T12:10:00Z");

function detail(over: Partial<LectureDetail>): LectureDetail {
  return {
    lecture_id: "lec_1",
    org_id: "o",
    has_chat: false,
    teacher_user_id: "t",
    status: "running",
    metadata: { chapter: "C" },
    shared_with_owner: false,
    analysis_available: false,
    total_cost_usd: 0,
    total_seconds: null,
    findings_summary: {},
    metrics_summary: null,
    created_at: "2026-10-21T12:00:00Z",
    updated_at: "2026-10-21T12:00:00Z",
    stages: [
      { stage: "ingest", status: "done", seconds: 20, cost_usd: 0, started_at: "2026-10-21T12:00:00Z", finished_at: "2026-10-21T12:00:20Z" },
      { stage: "asr", status: "running", seconds: null, cost_usd: null, started_at: "2026-10-21T12:09:00Z", finished_at: null },
    ],
    error: null,
    metrics: null,
    ...over,
  };
}

const estimate = {
  duration_ms: 3_600_000,
  asr_provider: "assemblyai",
  n_runs: 3,
  total_estimate_seconds: 300,
  reason_if_unavailable: null,
  stages: [
    { stage: "ingest", n_runs: 3, seconds_per_recording_minute: 0.5, estimate_seconds: 30 },
    { stage: "asr", n_runs: 3, seconds_per_recording_minute: 2, estimate_seconds: 120 },
    { stage: "findings", n_runs: 3, seconds_per_recording_minute: 1, estimate_seconds: 60 },
  ],
};

describe("processing status", () => {
  it("lists all 12 stages in order, unreported ones as waiting", () => {
    const rows = stageRows(detail({}).stages);
    expect(rows.map((r) => r.stage)).toEqual(["ingest", "asr", "diarize", "transcript", "redact", "questions", "structure", "coverage", "metrics", "findings", "notes", "report"]);
    expect(rows[2]?.status).toBe("pending");
  });

  it("estimates only from the API's per-stage figures: remaining stages, minus time spent", () => {
    const rows = stageRows(detail({}).stages);
    // asr: 120 s estimated, 60 s spent → 60; findings 60 → 120 s in all.
    expect(estimateText(rows, { kind: "ready", estimate }, NOW).main).toBe("About 2 min left.");
    expect(estimateText(rows, { kind: "ready", estimate }, NOW).detail).toContain("the last 3 lectures processed in your centre");
  });

  it("shows the API's reason, not a number, when there's no estimate", () => {
    const none = { ...estimate, n_runs: 0, stages: [], total_estimate_seconds: null, reason_if_unavailable: "no finished lectures processed with assemblyai yet to base an estimate on" };
    const t = estimateText(stageRows([]), { kind: "ready", estimate: none }, NOW);
    expect(t.main).toBe("No finished lectures processed with assemblyai yet to base an estimate on.");
    expect(t.main).not.toMatch(/\d/);
  });

  it("never guesses a length when the recording's length isn't known", () => {
    render(<StatusView detail={detail({})} role="teacher" estimate={{ kind: "no-duration" }} now={NOW} />);
    expect(screen.getByText(/There's no time estimate yet/)).toBeInTheDocument();
  });

  it("hides stage errors from owners and shows them to teachers", () => {
    const failed = detail({
      status: "failed",
      error: "worker crashed reading audio",
      stages: [{ stage: "ingest", status: "failed", seconds: 3, cost_usd: 0, started_at: null, finished_at: null, error: "worker crashed reading audio" }],
    });
    const { unmount } = render(<StatusView detail={failed} role="owner" estimate={{ kind: "no-duration" }} now={NOW} />);
    expect(screen.queryByText(/worker crashed/)).toBeNull();
    expect(screen.getByText(/The teacher or an admin can run it again/)).toBeInTheDocument();
    unmount();
    render(<StatusView detail={failed} role="teacher" estimate={{ kind: "no-duration" }} now={NOW} />);
    expect(screen.getAllByText(/worker crashed reading audio/).length).toBeGreaterThan(0);
  });
});
