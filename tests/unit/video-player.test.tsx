// Synthetic data only. The video dock and click-to-seek on findings.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { FindingEntry } from "~/components/FindingEntry";
import { PlayerBar, PlayerContext, type PlayerApi } from "~/media/player";
import { TranscriptLinkStub, finding } from "./fixtures";

let seeks: number[] = [];
let shown: boolean[] = [];

function player(over: Partial<PlayerApi> = {}): PlayerApi {
  return {
    state: { kind: "ready" },
    playing: false,
    currentMs: 0,
    durationMs: 3_600_000,
    playFrom: (ms) => {
      seeks.push(ms);
    },
    toggle: () => undefined,
    seek: () => undefined,
    isVideo: true,
    videoShown: true,
    setVideoShown: (s) => {
      shown.push(s);
    },
    ...over,
  };
}

function With({ p, children }: { p: PlayerApi; children: ReactNode }) {
  return <PlayerContext value={p}>{children}</PlayerContext>;
}

const twoRuns = finding({
  evidence: [
    { segment_ids: ["s0010"], start_ms: 61_000, end_ms: 70_000, quote: "First synthetic quote." },
    { segment_ids: ["s0040"], start_ms: 300_000, end_ms: 310_000, quote: "Second synthetic quote." },
  ],
  segment_ids: ["s0010", "s0040"],
});

beforeEach(() => {
  seeks = [];
  shown = [];
});

describe("findings seek the recording", () => {
  it("plays from the first evidence when the finding itself is clicked", async () => {
    render(
      <With p={player()}>
        <FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />
      </With>,
    );
    await userEvent.click(screen.getByText("Synthetic issue text."));
    expect(seeks).toEqual([61_000]);
    await userEvent.click(screen.getByRole("button", { name: "Watch from 01:01" }));
    expect(seeks).toEqual([61_000, 61_000]);
  });

  it("lets links and per-quote buttons keep their own meaning", async () => {
    render(
      <With p={player()}>
        <FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />
      </With>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Play from 05:00" }));
    expect(seeks).toEqual([300_000]); // only the second run, not also the finding's start
    const [link] = screen.getAllByRole("link", { name: "Read in transcript" });
    if (!link) throw new Error("no transcript link");
    await userEvent.click(link);
    expect(seeks).toEqual([300_000]);
  });

  it("marks the finding whose evidence is playing", () => {
    const { container, rerender } = render(
      <With p={player({ playing: true, currentMs: 305_000 })}>
        <FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />
      </With>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Now playing");
    expect(container.querySelector("article")).toHaveAttribute("data-now-playing");
    rerender(
      <With p={player({ playing: true, currentMs: 200_000 })}>
        <FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />
      </With>,
    );
    expect(screen.queryByText("Now playing")).toBeNull();
  });

  it("says Listen for an audio recording and offers nothing without one", () => {
    const { rerender } = render(
      <With p={player({ isVideo: false })}>
        <FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />
      </With>,
    );
    expect(screen.getByRole("button", { name: "Listen from 01:01" })).toBeInTheDocument();
    rerender(<FindingEntry finding={twoRuns} TranscriptLink={TranscriptLinkStub} />);
    expect(screen.queryByRole("button", { name: /from 01:01/ })).toBeNull();
  });
});

describe("player bar", () => {
  it("toggles the video dock for a video recording only", async () => {
    const { rerender } = render(
      <With p={player({ videoShown: true })}>
        <PlayerBar />
      </With>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide video" }));
    expect(shown).toEqual([false]);
    rerender(
      <With p={player({ isVideo: false })}>
        <PlayerBar />
      </With>,
    );
    expect(screen.queryByRole("button", { name: /video/ })).toBeNull();
  });
});
