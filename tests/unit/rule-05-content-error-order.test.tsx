import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingEntry } from "~/components/FindingEntry";
import { TranscriptLinkStub, finding } from "./fixtures";

describe("rule 5: content errors lead with intent", () => {
  it("orders intent, what the phrasing implies, correction, rephrasing", () => {
    const { container } = render(
      <FindingEntry
        finding={finding({
          category: "content_error",
          likely_intent: "INTENT-TEXT",
          what_the_phrasing_implies: "IMPLIES-TEXT",
          suggestion: "CORRECTION-TEXT",
          suggested_rephrasing: "REPHRASE-TEXT",
        })}
        TranscriptLink={TranscriptLinkStub}
      />,
    );
    const text = container.textContent;
    const order = ["INTENT-TEXT", "IMPLIES-TEXT", "CORRECTION-TEXT", "REPHRASE-TEXT"].map((t) => text.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain("Correction");
  });
});
