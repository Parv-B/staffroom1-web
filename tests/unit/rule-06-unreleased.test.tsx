import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingCounts } from "~/components/FindingCounts";

describe("rule 6: unreleased categories are 'not yet reported', never zero", () => {
  it("labels unreleased categories and says 'none' only for released ones", () => {
    const { container } = render(<FindingCounts counts={{ strength: { minor: 4 } }} released={["pedagogy", "strength"]} />);
    expect(screen.getByText(/Not yet reported \(still being validated\)/)).toHaveTextContent("content accuracy, explanation gaps, classroom conduct");
    expect(screen.getByText("Teaching practice").parentElement).toHaveTextContent("none");
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(container.textContent).not.toMatch(/Content accuracy\s*none/i);
  });

  it("claims nothing about categories it can't classify when the released list is unknown", () => {
    const { container } = render(<FindingCounts counts={{ strength: { minor: 2 } }} released={null} />);
    expect(container.textContent).not.toContain("none");
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(screen.getByText("Other categories: open the analysis")).toBeInTheDocument();
  });
});
