import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingCounts } from "~/components/FindingCounts";

describe("rule 6: categories a lecture wasn't checked for are 'not checked for this lesson', never zero", () => {
  it("labels unreleased categories and says 'none' only for released ones", () => {
    const { container } = render(<FindingCounts counts={{ strength: { minor: 4 } }} released={["pedagogy", "strength"]} />);
    expect(screen.getByText(/Not checked for this lesson/)).toHaveTextContent("content accuracy, teaching shortcomings, classroom conduct");
    expect(screen.getByText("Teaching practice").parentElement).toHaveTextContent("none");
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(container.textContent).not.toMatch(/Content accuracy\s*none/i);
    expect(container.textContent).not.toMatch(/still being validated/);
  });

  it("with no report yet (released null), claims nothing about categories without findings", () => {
    const { container } = render(<FindingCounts counts={{ strength: { minor: 2 } }} released={null} />);
    expect(container.textContent).not.toContain("none");
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(screen.getByText("Other categories: open the analysis")).toBeInTheDocument();
  });
});
