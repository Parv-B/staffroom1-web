import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CentreTrendChart } from "~/centre/CentreTrendChart";
import { filtersText, parseBucket, parseFilters, parseGroupBy, summaryRows, type GroupSummary, type MetricAggregate, type OrgSummary } from "~/centre/summary";
import { bucketPoint, buildCentreTrend, describeBucket, trendSummary, type OrgTrend, type TrendBucket } from "~/centre/trend";

const M = "wait_time_median_s";

const agg = (over: Partial<MetricAggregate> = {}): MetricAggregate => ({
  unit: "s",
  n_lectures_with_value: 4,
  median: 2,
  p25: 1.5,
  p75: 3,
  n_low_confidence: 0,
  n_null: 0,
  most_common_null_reason: null,
  n_not_computed: 0,
  ...over,
});
const empty = agg({ n_lectures_with_value: 0, median: null, p25: null, p75: null, unit: null });

function bucket(start: string, n: number, a: MetricAggregate, over: Partial<TrendBucket> = {}): TrendBucket {
  return { start, end: start, partial: false, n_lectures: n, n_done: n, n_done_without_metrics: 0, metrics: { [M]: a }, ...over };
}

// Week 1: 4 values; week 2: no lectures; week 3: two values, one low confidence;
// week 4: lectures but every value missing; week 5: one value; week 6: a real zero.
const trend: OrgTrend = {
  org_id: "o",
  bucket: "week",
  date_basis: "created_at",
  from_date: "2026-09-01",
  to_date: "2026-10-11",
  teacher_user_id: null,
  metadata_filters: [],
  metric_names: [M],
  buckets: [
    bucket("2026-08-31", 4, agg()),
    bucket("2026-09-07", 0, empty),
    bucket("2026-09-14", 2, agg({ n_lectures_with_value: 2, median: 4, p25: 3.5, p75: 4.5, n_low_confidence: 1 })),
    bucket("2026-09-21", 3, agg({ n_lectures_with_value: 0, median: null, p25: null, p75: null, n_null: 3, most_common_null_reason: "No questions were asked" })),
    bucket("2026-09-28", 1, agg({ n_lectures_with_value: 1, median: 5, p25: 5, p75: 5 })),
    bucket("2026-10-05", 2, agg({ n_lectures_with_value: 3, median: 0, p25: 0, p75: 1 }), { n_done: 3 }),
  ],
};
const t = buildCentreTrend(trend, M);
const point = (i: number) => {
  const p = t.points[i];
  if (!p) throw new Error(`no point ${i.toString()}`);
  return p;
};

describe("centre measures over time: buckets (rules 1, 2)", () => {
  it("keeps every bucket as a slot, in the API's order", () => {
    expect(t.points.map((p) => p.slot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(t.points.map((p) => p.state)).toEqual(["value", "no-lectures", "value", "na", "value", "value"]);
  });

  it("breaks the line at empty and N/A buckets, never joining across them or drawing a zero", () => {
    expect(t.runs.map((r) => r.map((p) => p.slot))).toEqual([[0], [2], [4, 5]]);
    expect(t.points[1]).toMatchObject({ median: null, n: 0, reason: "No lectures were uploaded in this period." });
    expect(t.points[3]).toMatchObject({ median: null, reason: "Missing in 3 lectures: No questions were asked." });
    expect(t.points[5]).toMatchObject({ state: "value", median: 0, medianText: "0.0 s" }); // a real zero stays
  });

  it("explains a bucket whose lectures haven't finished", () => {
    const p = bucketPoint(bucket("2026-10-12", 2, empty, { n_done: 0 }), M, 0);
    expect(p).toMatchObject({ state: "na", reason: "None of the 2 lectures has finished processing." });
  });

  it("marks buckets resting on one or two values, and states the n", () => {
    expect(t.points.filter((p) => p.few).map((p) => [p.slot, p.n])).toEqual([[2, 2], [4, 1]]);
    expect(t.points[0]?.few).toBe(false);
    expect(describeBucket(point(4), "week")).toBe("Week of 28 Sept 2026: median 5.0 s, only 1 lecture with a value.");
    expect(t.points[4]?.rangeText).toBeNull(); // no middle half from one value
  });

  it("marks low confidence with how many of how many", () => {
    expect(t.points[2]?.lowConfidence).toBe(1);
    expect(describeBucket(point(2), "week")).toContain("1 of 2 low confidence");
  });

  it("starts the axis at zero and fits the middle half", () => {
    expect(t.axis?.ticks[0]?.value).toBe(0);
    expect(t.axis?.max).toBeGreaterThanOrEqual(5);
  });

  it("describes the chart in counts only", () => {
    const s = trendSummary(t);
    expect(s).toBe(
      "6 weeks: 4 have a value; 2 of them from only one or two lectures (marked n=1 or n=2); 1 include low-confidence values (hollow markers); 2 without a value, shown as breaks in the line. Exact values are in the table below.",
    );
    expect(s).not.toMatch(/\b(trend|forecast|improv|declin|better|worse)/i);
  });
});

describe("centre chart rendering", () => {
  it("draws a gap and N/A instead of points, n labels on few-lecture buckets, and hollow low-confidence markers", () => {
    const { container } = render(<CentreTrendChart trend={t} />);
    const states = [...container.querySelectorAll("[data-bucket-state]")].map((e) => e.getAttribute("data-bucket-state"));
    expect(states).toEqual(["value", "no-lectures", "value", "na", "value", "value"]);
    expect([...container.querySelectorAll("[data-few-label]")].map((e) => e.textContent)).toEqual(["n=2", "n=1"]);
    expect(container.querySelectorAll("[data-low-confidence]")).toHaveLength(1);
    expect(container.querySelectorAll("polyline")).toHaveLength(1); // only slots 4-5 are joined
    expect(container.querySelector("polyline")?.getAttribute("data-run")).toBe("4,5");
    const gap = screen.getByRole("img", { name: /Week of 7 Sept 2026: no lectures/ });
    fireEvent.focus(gap);
    expect(container.querySelector("[data-trend-tooltip]")?.textContent).toContain("No lectures");
    fireEvent.focus(screen.getByRole("img", { name: /Week of 28 Sept 2026/ }));
    expect(container.querySelector("[data-trend-tooltip]")?.textContent).toContain("Rests on only 1 lecture");
  });

  it("says there is nothing to plot when no bucket has a value", () => {
    render(<CentreTrendChart trend={buildCentreTrend({ ...trend, buckets: [bucket("2026-09-07", 0, empty)] }, M)} />);
    expect(screen.getByText("Nothing to plot: no week has a value for this measure.")).toBeTruthy();
  });
});

function group(n: number): GroupSummary {
  return { n_lectures: n, lectures_by_status: { done: n }, n_done_without_metrics: 0, findings: {}, findings_n_lectures: {}, n_done_categories_unknown: 0, metrics: {} };
}

const base: OrgSummary = {
  org_id: "o",
  from_date: null,
  to_date: null,
  teacher_user_id: null,
  released_categories: [],
  metric_names: [M],
  org: group(5),
  teachers: [
    { ...group(3), teacher_user_id: "u1", display_name: "Asha", active: true },
    { ...group(2), teacher_user_id: "u2", display_name: "Zed", active: false },
  ],
  group_by: "teacher",
  metadata_filters: [],
  groups: [],
};

describe("group by teacher / subject / grade", () => {
  it("lists teachers when grouped by teacher, whole centre first", () => {
    const rows = summaryRows(base);
    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ["org", "Whole centre"],
      ["teacher", "Asha"],
      ["teacher", "Zed"],
    ]);
  });

  it("switches to the API's subject groups, in the API's order (never re-sorted by a number)", () => {
    const s: OrgSummary = {
      ...base,
      group_by: "subject",
      groups: [
        { ...group(1), key: "biology", label: "Biology" },
        { ...group(9), key: "mathematics", label: "Mathematics" },
        { ...group(2), key: null, label: "Not recorded" },
      ],
    };
    const rows = summaryRows(s);
    expect(rows.map((r) => r.label)).toEqual(["Whole centre", "Biology", "Mathematics", "Not recorded"]);
    expect(rows.every((r) => r.kind === "org" || r.kind === "subject")).toBe(true);
  });

  it("labels grades and keeps numeric order", () => {
    const s: OrgSummary = { ...base, group_by: "grade", groups: [{ ...group(1), key: "9", label: "9" }, { ...group(1), key: "10", label: "10" }, { ...group(1), key: null, label: "Not recorded" }] };
    expect(summaryRows(s).map((r) => r.label)).toEqual(["Whole centre", "Grade 9", "Grade 10", "Not recorded"]);
  });

  it("reads the controls from the address, falling back safely", () => {
    expect(parseGroupBy("subject")).toBe("subject");
    expect(parseGroupBy("teacher_wpm")).toBe("teacher");
    expect(parseBucket("month")).toBe("month");
    expect(parseBucket("day")).toBe("week");
    expect(parseFilters({ subject: "Maths", grade: "10", teacher: "usr_1", other: "x" })).toEqual({ subject: "Maths", grade: "10", teacher: "usr_1" });
    expect(parseFilters({ subject: "<script>", teacher: "../x" })).toEqual({});
    expect(filtersText({ subject: "Mathematics", grade: "10" }, null)).toBe("Mathematics, grade 10");
    expect(filtersText({}, null)).toBeNull();
  });
});
