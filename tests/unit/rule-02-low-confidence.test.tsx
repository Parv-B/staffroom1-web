import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricValue } from "~/components/MetricValue";
import { fromBrief, fromResult } from "~/metrics/reading";

describe("rule 2: low confidence is visible with its reason", () => {
  it("badges a low-confidence analysis metric and shows its reason", () => {
    const reading = fromResult("wait_time_median_s", {
      unit: "s",
      definition: "d",
      data_source: "s",
      confidence: "low",
      value: 1.31,
      reason_low_confidence: "audio only; chat replies not counted",
    });
    const { container } = render(<MetricValue reading={reading} />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("audio only; chat replies not counted")).toBeInTheDocument();
    expect(screen.getByText("1.3 s")).toBeInTheDocument();
    expect(container.querySelector("[data-metric-state='low-confidence']")).not.toBeNull();
  });

  it("uses the list's single reason field for a low-confidence value", () => {
    render(<MetricValue reading={fromBrief("teacher_wpm", { value: 150, unit: "words/min", confidence: "low", reason: "few teacher words" })} />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("few teacher words")).toBeInTheDocument();
  });

  it("shows no badge for a high-confidence value", () => {
    render(<MetricValue reading={fromBrief("teacher_wpm", { value: 150, unit: "words/min", confidence: "high", reason: null })} />);
    expect(screen.queryByText("Low confidence")).toBeNull();
  });
});
