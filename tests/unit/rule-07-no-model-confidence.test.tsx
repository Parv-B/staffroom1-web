import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingEntry } from "~/components/FindingEntry";
import { TranscriptLinkStub, WithPlayer, finding } from "./fixtures";

describe("rule 7: detector and verifier confidences are never displayed", () => {
  it("renders no confidence numbers or verifier rationale", () => {
    const { container } = render(
      <WithPlayer>
        <FindingEntry finding={finding({ detector_confidence: 0.87, verifier_confidence: 0.93 })} TranscriptLink={TranscriptLinkStub} />
      </WithPlayer>,
    );
    const text = container.textContent;
    for (const s of ["0.87", "87%", "0.93", "93%", "Synthetic rationale.", "confirmed", "confidence"]) expect(text).not.toContain(s);
  });
});
