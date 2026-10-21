import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricValue } from "~/components/MetricValue";
import { fromBrief, fromResult } from "~/metrics/reading";

describe("rule 1: a null metric is N/A with its reason, never 0 or 100%", () => {
  it("renders N/A and the reason for a null analysis metric", () => {
    const reading = fromResult("wait_time_median_s", {
      unit: "s",
      definition: "d",
      data_source: "s",
      confidence: "high",
      value: null,
      reason_if_null: "The teacher asked no open or closed questions.",
    });
    const { container } = render(<MetricValue reading={reading} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("The teacher asked no open or closed questions.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("does the same for a null list metric (MetricBrief), including fractions", () => {
    const reading = fromBrief("student_talk_share", { value: null, unit: "fraction", confidence: "high", reason: "No speech detected." });
    const { container } = render(<MetricValue reading={reading} />);
    expect(container.textContent).toContain("N/A");
    expect(container.textContent).not.toMatch(/0%|100%/);
  });

  it("still shows N/A, with a stated gap, when the API gave no reason", () => {
    const reading = fromBrief("teacher_wpm", { value: null, unit: "words/min", confidence: "high", reason: null });
    render(<MetricValue reading={reading} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("No reason was recorded.")).toBeInTheDocument();
  });

  it("shows a real zero as a value, distinct from N/A", () => {
    const reading = fromBrief("language_share_ar", { value: 0, unit: "fraction", confidence: "high", reason: null });
    const { container } = render(<MetricValue reading={reading} />);
    expect(container.textContent).toBe("0%");
    expect(container.querySelector("[data-metric-state='na']")).toBeNull();
  });
});
