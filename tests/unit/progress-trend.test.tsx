import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LectureSummary } from "~/lectures/vocab";
import { TrendChart } from "~/progress/TrendChart";
import { axisFor, buildTrend, niceStep } from "~/progress/trend";

type Brief = NonNullable<LectureSummary["metrics_summary"]>[string];

function lecture(id: string, day: number, brief: Brief | null, status: LectureSummary["status"] = "done"): LectureSummary {
  const created = `2026-10-${day.toString().padStart(2, "0")}T09:00:00Z`;
  return {
    lecture_id: id,
    org_id: "o",
    has_chat: false,
    has_unseen_results: false,
    teacher_user_id: "t",
    analysis_available: status === "done",
    total_cost_usd: 0,
    total_seconds: 0,
    status,
    metadata: { board: "CBSE", grade: "10", subject: "Mathematics", chapter: `Chapter ${id}`, class_type: "online" },
    shared_with_owner: false,
    findings_summary: {},
    metrics_summary: brief ? { wait_time_median_s: brief } : {},
    created_at: created,
    updated_at: created,
  };
}

const v = (value: number, confidence: "high" | "low" = "high", reason: string | null = null): Brief => ({ value, unit: "s", confidence, reason });
const na = (reason: string): Brief => ({ value: null, unit: "s", confidence: "high", reason });

// Upload order: a(1) b(2) c(3, N/A) d(4) e(5, not computed) f(6, low) g(7, running: left out).
const lectures = [
  lecture("d", 4, v(2)),
  lecture("a", 1, v(1.5)),
  lecture("c", 3, na("No questions were asked.")),
  lecture("b", 2, v(0)),
  lecture("f", 6, v(3.2, "low", "Audio only.")),
  lecture("e", 5, null),
  lecture("g", 7, v(9), "running"),
];
const trend = buildTrend(lectures, "wait_time_median_s");

describe("measures over time: the line (rules 1, 2)", () => {
  it("has one point per analysed lecture, oldest first", () => {
    expect(trend.points.map((p) => p.lectureId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(trend.points.map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("breaks the line at N/A and not-computed values instead of joining across them", () => {
    expect(trend.runs.map((r) => r.map((p) => p.lectureId))).toEqual([["a", "b"], ["d"], ["f"]]);
  });

  it("never turns N/A into zero, and keeps a real zero", () => {
    const c = trend.points[2];
    expect(c).toMatchObject({ state: "na", value: null, text: null, reason: "No questions were asked." });
    expect(trend.points[4]).toMatchObject({ state: "not-computed", value: null });
    expect(trend.points[1]).toMatchObject({ state: "value", value: 0, text: "0.0 s" });
  });

  it("keeps low confidence as its own state with the reason", () => {
    expect(trend.points[5]).toMatchObject({ state: "low-confidence", value: 3.2, reason: "Audio only." });
    expect(trend.counts).toEqual({ plotted: 4, lowConfidence: 1, na: 1, notComputed: 1 });
  });

  it("starts the axis at zero and ends at a round number at or above the largest value", () => {
    expect(trend.axis?.ticks[0]?.value).toBe(0);
    expect(trend.axis?.max).toBe(4);
    expect(trend.axis?.unitLabel).toBe("seconds");
  });

  it("has nothing to plot when every lecture is N/A", () => {
    const empty = buildTrend([lecture("x", 1, na("No questions were asked."))], "wait_time_median_s");
    expect(empty.axis).toBeNull();
    expect(empty.runs).toEqual([]);
  });
});

describe("axes", () => {
  it("gives shares the whole 0-100% range, however small the values", () => {
    expect(axisFor("fraction", 0.04)).toMatchObject({ max: 1, unitLabel: "per cent" });
  });

  it("switches long durations to minutes and keeps counts on whole numbers", () => {
    const a = axisFor("s", 1000);
    expect(a.unitLabel).toBe("minutes");
    expect(a.max % 60).toBe(0);
    expect(a.max).toBeGreaterThanOrEqual(1000);
    expect(axisFor("count", 3).ticks.every((t) => Number.isInteger(t.value))).toBe(true);
    expect(axisFor("count", 0).max).toBeGreaterThan(0);
    expect(niceStep(37)).toBe(10);
  });
});

describe("the chart", () => {
  it("draws only the runs, marks low confidence as hollow and N/A as a labelled break", () => {
    const { container } = render(<TrendChart trend={trend} />);
    const lines = container.querySelectorAll("polyline");
    expect(lines).toHaveLength(1); // a-b; d and f are lone points
    expect(lines[0]?.getAttribute("data-run")).toBe("0,1");
    const states = [...container.querySelectorAll("[data-point-state]")].map((g) => g.getAttribute("data-point-state"));
    expect(states).toEqual(["value", "value", "na", "value", "not-computed", "low-confidence"]);
    const low = container.querySelector('[data-point-state="low-confidence"] circle:last-child');
    expect(low?.getAttribute("fill")).toBe("var(--sheet)"); // hollow
    expect(container.querySelector('[data-point-state="na"]')?.textContent).toContain("N/A");
    expect(screen.getByText(/Vertical axis: 0 to 4 seconds, from zero/)).toBeInTheDocument();
  });

  it("lets every point be focused, with the value and reason as text", () => {
    const { container } = render(<TrendChart trend={trend} />);
    const points = [...container.querySelectorAll<SVGGElement>("[data-point-state]")];
    expect(points.every((g) => g.getAttribute("tabindex") === "0")).toBe(true);
    expect(points[5]?.getAttribute("aria-label")).toMatch(/Chapter f: 3\.2 s, low confidence\. Audio only\./);
    expect(points[2]?.getAttribute("aria-label")).toMatch(/Chapter c: N\/A\. No questions were asked\./);
    const low = points[5];
    if (!low) throw new Error("missing point");
    fireEvent.focus(low);
    expect(container.querySelector("[data-trend-tooltip]")?.textContent).toContain("Low confidence: Audio only.");
    fireEvent.blur(low);
    expect(container.querySelector("[data-trend-tooltip]")).toBeNull();
  });

  it("describes itself in words without any direction or judgement", () => {
    render(<TrendChart trend={trend} />);
    const caption = screen.getByText(/analysed lectures by upload date/);
    expect(caption.textContent).toContain("1 of them low confidence");
    expect(caption.textContent).toContain("2 are N/A, shown as breaks in the line");
    expect(caption.textContent).not.toMatch(/improv|better|worse|increas|decreas|average|target/i);
  });

  it("draws no fitted line, target or reference line", () => {
    const { container } = render(<TrendChart trend={trend} />);
    // Only gridlines (one per tick) are <line>s; the data is polylines and markers.
    expect(container.querySelectorAll("line")).toHaveLength(trend.axis?.ticks.length ?? 0);
  });
});
