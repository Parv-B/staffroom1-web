import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeacherSummary } from "~/analysis/TeacherSummary";
import { analysis, finding } from "./fixtures";

describe("rule 10: the teacher summary is rendered as provided and linked to its findings", () => {
  it("renders the text verbatim and links top findings and strengths", () => {
    const text = "Line one.\n\nWhat worked well (showing 1 of 1):\n1. At 01:01: Synthetic issue text.";
    const a = analysis({
      findings: [finding({ category: "strength", severity: "minor" })],
      teacher_summary: { text, top_findings: ["f_ffffffffffffffff"], top_strengths: ["f_0123456789abcdef"] },
    });
    const { container } = render(<TeacherSummary a={a} FindingLink={({ findingId, children }) => <a href={`#${findingId}`}>{children}</a>} />);
    expect(container.querySelector("[data-summary-text]")?.textContent).toBe(text);
    expect(screen.getByRole("link", { name: "Synthetic issue text." })).toHaveAttribute("href", "#f_0123456789abcdef");
    expect(screen.getByText("A finding the summary refers to isn't in this analysis.")).toBeInTheDocument();
  });
});
