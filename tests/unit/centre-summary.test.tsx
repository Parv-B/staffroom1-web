import { describe, expect, it } from "vitest";
import { findingCell, metricCell, parseRange, type GroupSummary, type MetricAggregate } from "~/centre/summary";

const agg = (over: Partial<MetricAggregate> = {}): MetricAggregate => ({
  unit: "s",
  n_lectures_with_value: 3,
  median: 1.4,
  p25: 1.1,
  p75: 1.9,
  n_low_confidence: 1,
  n_null: 0,
  most_common_null_reason: null,
  n_not_computed: 0,
  ...over,
});

function group(over: Partial<GroupSummary> = {}): GroupSummary {
  const zero = { info: 0, minor: 0, moderate: 0, important: 0 };
  return {
    n_lectures: 2,
    lectures_by_status: { awaiting_upload: 0, queued: 0, running: 0, done: 2, failed: 0 },
    n_done_without_metrics: 0,
    findings: { pedagogy: { ...zero, minor: 1, moderate: 2 }, strength: { ...zero, minor: 3 }, content_error: zero },
    findings_n_lectures: { pedagogy: 2, strength: 2, content_error: 0 },
    n_done_categories_unknown: 0,
    metrics: {},
    ...over,
  };
}

describe("centre summary cells (rules 1, 2 and 6 for aggregates)", () => {
  it("shows a median and middle half as given", () => {
    expect(metricCell(agg(), 3)).toEqual({ kind: "value", median: "1.4 s", range: "1.1 s to 1.9 s", n: 3 });
  });

  it("is N/A with the reason when every value is missing, never 0", () => {
    const c = metricCell(agg({ n_lectures_with_value: 0, median: null, p25: null, p75: null, n_null: 2, most_common_null_reason: "No questions were asked" }), 2);
    expect(c).toEqual({ kind: "na", reason: "Missing in 2 lectures: No questions were asked." });
    expect(metricCell(agg({ n_lectures_with_value: 0, median: null, p25: null, p75: null }), 0)).toEqual({ kind: "na", reason: "No finished lectures in this period." });
    expect(metricCell(undefined, 2).kind).toBe("na");
  });

  it("doesn't show a range for a single value", () => {
    expect(metricCell(agg({ n_lectures_with_value: 1, p25: 1.4, p75: 1.4 }), 1)).toMatchObject({ range: null });
  });

  it("a category no lecture was checked for is 'not checked', and an unreleased one 'not yet reported', never zero", () => {
    const released = ["pedagogy", "strength", "content_error"];
    expect(findingCell(group(), "content_error", released, false)).toEqual({ kind: "not-checked" });
    expect(findingCell(group(), "conduct", released, false)).toEqual({ kind: "not-released" });
    expect(findingCell(group(), "pedagogy", released, false)).toEqual({ kind: "count", n: 3, lectures: 2, bySeverity: "2 moderate, 1 minor" });
    expect(findingCell(group(), "strength", released, true)).toEqual({ kind: "count", n: 3, lectures: 2, bySeverity: null });
  });

  it("accepts only ISO dates in the period", () => {
    expect(parseRange({ from: "2026-10-01", to: "nope" })).toEqual({ from: "2026-10-01" });
  });
});
