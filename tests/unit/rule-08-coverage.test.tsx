import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverageView } from "~/analysis/CoverageView";
import type { Coverage } from "~/analysis/types.gen";
import { segment } from "./fixtures";

const segs = new Map([["s0010", segment("s0010", 61_000, "teacher", "One.")]]);
const Moment = ({ startMs, children }: { startMs: number; children: React.ReactNode }) => <a href={`#t${startMs.toString()}`}>{children}</a>;

function coverage(over: Partial<Coverage>): Coverage {
  return {
    objective_source: "model_knowledge",
    objectives_reviewed: false,
    not_covered_means: "not_in_this_lesson",
    objectives: [
      { objective: "Objective A", status: "covered", evidence_segment_ids: ["s0010"] },
      { objective: "Objective B", status: "not_covered", evidence_segment_ids: [] },
    ],
    // Deliberately different from the list above: the UI must show these numbers, not recount.
    summary_counts: { covered: 7, partial: 0, not_covered: 2, deferred: 1 },
    ...over,
  };
}

describe("rule 8: coverage is shown as given, and not-in-this-lesson is not a gap", () => {
  it("shows summary counts exactly as given, never as a percentage", () => {
    const { container } = render(<CoverageView coverage={coverage({})} segments={segs} Moment={Moment} />);
    const counts = container.querySelector("[data-summary-counts]");
    expect(counts).toHaveTextContent("7 covered, 0 partly covered, 2 not in this lesson, 1 left for a later lesson");
    expect(container.textContent).not.toContain("%");
  });

  it("labels untouched objectives 'not in this lesson' and says the list is unreviewed", () => {
    const { container } = render(<CoverageView coverage={coverage({})} segments={segs} Moment={Moment} />);
    expect(screen.getAllByText("Not in this lesson").length).toBeGreaterThan(0);
    const untouched = container.querySelector("[data-coverage-status='not_covered']");
    expect(untouched).toHaveTextContent("Not in this lesson");
    expect(untouched).not.toHaveClass("text-ochre"); // never styled as something to review
    expect(container.querySelector("[data-unreviewed]")).toHaveTextContent("No one has reviewed this objective list yet");
    expect(screen.getByRole("link", { name: "01:01" })).toBeInTheDocument();
  });

  it("calls an untouched objective a gap only for the lesson's own objectives", () => {
    const { container } = render(<CoverageView coverage={coverage({ objective_source: "lesson_plan", objectives_reviewed: true, not_covered_means: "gap" })} segments={segs} Moment={Moment} />);
    expect(container.querySelector("[data-coverage-status='not_covered']")).toHaveTextContent("Not covered");
    expect(container.querySelector("[data-unreviewed]")).toBeNull();
  });
});
