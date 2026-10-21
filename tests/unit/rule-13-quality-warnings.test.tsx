import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QualityWarnings } from "~/analysis/sections";
import { analysis } from "./fixtures";

describe("rule 13: quality warnings are shown where they affect the numbers", () => {
  it("lists every warning as given", () => {
    const warnings = ["diarization uncertain for 4 minutes", "audio has 2 channels; downmixed to mono"];
    const base = analysis();
    render(<QualityWarnings a={{ ...base, quality: { ...base.quality, warnings } }} intro="Some affect these measures." />);
    expect(screen.getByText("2 notes from processing")).toBeInTheDocument();
    for (const w of warnings) expect(screen.getByText(w)).toBeInTheDocument();
  });

  it("shows nothing when there are no warnings", () => {
    const { container } = render(<QualityWarnings a={analysis()} intro="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
