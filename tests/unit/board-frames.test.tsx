import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BoardFrame } from "~/analysis/types.gen";
import { TranscriptLines } from "~/components/TranscriptLines";
import { segment } from "./fixtures";

const frame = (id: string, start: number, time: number, content: string): BoardFrame => ({
  frame_id: id,
  start_ms: start,
  time_ms: time,
  kind: "board",
  content,
  image: null,
});

describe("board frames in the transcript", () => {
  it("places each frame before the first line spoken at or after it, and keeps the reading as given", () => {
    const segs = [segment("s0010", 60_000, "teacher", "One."), segment("s0011", 120_000, "teacher", "Two.")];
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TranscriptLines
          segments={segs}
          findings={[]}
          FindingLink={({ children }) => <a href="#f">{children}</a>}
          board={{
            lectureId: "lec_x",
            frames: [frame("b0001", 30_000, 90_000, "Δx·Δp ≥ h/4π\nE = p^2/2m"), frame("b0002", 125_000, 130_000, "[graph: ψ^2 against r]")],
          }}
        />
      </QueryClientProvider>,
    );
    const order = [...container.querySelectorAll("ol > li")].map((li) => li.id || li.querySelector("[data-board-frame]")?.getAttribute("data-board-frame"));
    expect(order).toEqual(["seg-s0010", "b0001", "seg-s0011", "b0002"]);
    expect(screen.getByText(/Δx·Δp ≥ h\/4π/)).toBeInTheDocument();
    expect(screen.getByText("Board, 00:30–01:30.")).toBeInTheDocument();
  });
});
