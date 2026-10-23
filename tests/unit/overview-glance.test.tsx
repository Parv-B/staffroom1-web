import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { firstSentence } from "~/analysis/FocusLists";
import { placeMarks } from "~/analysis/LessonTimeline";
import { ProfileChart } from "~/analysis/ProfileChart";
import { idsToTimes, withTimesInProse } from "~/analysis/prose";
import type { AspectJudgement, EvidenceRun } from "~/analysis/types.gen";
import { ASPECTS } from "~/findings/aspects";
import { analysis, finding } from "./fixtures";

describe("lesson at a glance", () => {
  it("lists rated aspects weakest first, with the level as a word and a link to the detail", () => {
    const levels: Partial<
      Record<AspectJudgement["aspect"], AspectJudgement["level"]>
    > = {
      questioning_dialogue: "good",
      subject_knowledge: "weak",
      application_connections: "very_good",
    };
    const aspects = ASPECTS.map((x): AspectJudgement => ({
      aspect: x.id,
      level: levels[x.id] ?? null,
      reason_if_no_level: levels[x.id] ? null : "not shown",
    })) as [AspectJudgement, ...AspectJudgement[]];
    const { container } = render(<ProfileChart j={{ aspects }} />);
    const rows = [...container.querySelectorAll("li[data-aspect]")];
    expect(rows.map((r) => r.getAttribute("data-aspect"))).toEqual([
      "subject_knowledge",
      "questioning_dialogue",
      "application_connections",
    ]);
    expect(rows[0]).toHaveTextContent("Weak");
    expect(rows[0]?.querySelector("a")).toHaveAttribute(
      "href",
      "#aspect-subject_knowledge",
    );
    expect(container).toHaveTextContent("8 aspects couldn't be rated");
  });
});

describe("where it happened", () => {
  it("puts a marker at each evidence run and stacks close ones in lanes", () => {
    const run = (ms: number): EvidenceRun => ({
      segment_ids: ["s0001"] as [string],
      start_ms: ms,
      end_ms: ms + 1000,
      quote: "x",
    });
    const a = finding({
      finding_id: "f_000000000000000a",
      evidence: [run(10_000), run(500_000)],
    });
    const b = finding({
      finding_id: "f_000000000000000b",
      evidence: [run(12_000)],
    });
    const marks = placeMarks([a, b], 1_000_000);
    expect(marks.map((m) => [m.f.finding_id, Math.round(m.x), m.lane])).toEqual(
      [
        ["f_000000000000000a", 1, 0],
        ["f_000000000000000b", 1, 1],
        ["f_000000000000000a", 50, 0],
      ],
    );
  });

  it("keeps the first sentence for short lists", () => {
    expect(
      firstSentence("The teacher answers own questions. Then moves on."),
    ).toBe("The teacher answers own questions.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });
});

describe("times instead of line ids", () => {
  it("rewrites ids and ranges it knows, and leaves others", () => {
    const starts = new Map([
      ["s0277", 1_300_000],
      ["s0280", 1_330_000],
    ]);
    expect(
      idsToTimes("Starts at s0277 (s0277-s0280); s9999 stays.", starts),
    ).toBe("Starts at 21:40 (21:40–22:10); s9999 stays.");
  });

  it("applies to finding prose but not to the quote", () => {
    const base = analysis({ findings: [finding({ issue: "x" })] });
    const seg = base.transcript.segments[0];
    if (!seg) throw new Error("fixture has no segments");
    const a = {
      ...base,
      findings: [
        finding({ issue: `At ${seg.segment_id}.`, quote: seg.segment_id }),
      ],
    };
    const out = withTimesInProse(a);
    expect(out.findings?.[0]?.issue).not.toContain(seg.segment_id);
    expect(out.findings?.[0]?.quote).toBe(seg.segment_id);
  });
});
