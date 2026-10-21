import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FindingEntry } from "~/components/FindingEntry";
import { TranscriptLinkStub, WithPlayer, finding, playFrom } from "./fixtures";

describe("rule 4: every claim links to its evidence", () => {
  it("shows the verbatim quote, a transcript link and an audio link", async () => {
    render(
      <WithPlayer>
        <FindingEntry finding={finding()} TranscriptLink={TranscriptLinkStub} />
      </WithPlayer>,
    );
    expect(screen.getByText("“Synthetic quote for the test.”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read in transcript" })).toHaveAttribute("href", "/transcript?t=61000&finding=f_0123456789abcdef");
    await userEvent.click(screen.getByRole("button", { name: "Play from 01:01" }));
    expect(playFrom).toContain(61_000);
  });

  it("never shows the claim of a finding that has no evidence", () => {
    render(<FindingEntry finding={finding({ evidence: [] as unknown as ReturnType<typeof finding>["evidence"] })} TranscriptLink={TranscriptLinkStub} />);
    expect(screen.queryByText("Synthetic issue text.")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("hidden because it arrived without its evidence");
  });
});
