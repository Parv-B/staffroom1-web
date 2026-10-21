import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionOrReason } from "~/analysis/sections";
import { analysis } from "./fixtures";

describe("rule 9: a missing section shows its unavailable reason in its place", () => {
  it("shows the reason instead of the section", () => {
    render(
      <SectionOrReason a={analysis({ coverage: null, unavailable: { coverage: "no objectives could be found for this chapter" } })} section="coverage">
        <p>COVERAGE CONTENT</p>
      </SectionOrReason>,
    );
    expect(screen.getByText("Reason: no objectives could be found for this chapter")).toBeInTheDocument();
    expect(screen.queryByText("COVERAGE CONTENT")).toBeNull();
  });

  it("still says so when a section is missing without a reason", () => {
    render(
      <SectionOrReason a={analysis({ structure: null })} section="structure">
        <p>STRUCTURE</p>
      </SectionOrReason>,
    );
    expect(screen.getByText("No reason was recorded.")).toBeInTheDocument();
  });

  it("renders the section when it is present", () => {
    render(
      <SectionOrReason a={analysis({ problems: [] })} section="problems">
        <p>PROBLEMS</p>
      </SectionOrReason>,
    );
    expect(screen.getByText("PROBLEMS")).toBeInTheDocument();
  });
});
