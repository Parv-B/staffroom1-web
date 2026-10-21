import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TranscriptLines } from "~/components/TranscriptLines";
import { WithPlayer, finding, segment } from "./fixtures";

describe("rule 12: transcript lines carry speaker and time; redaction is kept", () => {
  it("shows speaker and mm:ss on every line and leaves [student] as is", () => {
    const segs = [segment("s0010", 61_000, "teacher", "Tell me, [student], what is h?"), segment("s0011", 3_725_000, "student", "Fourteen."), segment("s0012", 3_727_000, "unknown", "Okay.")];
    render(
      <WithPlayer>
        <TranscriptLines segments={segs} findings={[]} FindingLink={({ children }) => <a href="#f">{children}</a>} />
      </WithPlayer>,
    );
    expect(screen.getByText("Tell me, [student], what is h?")).toBeInTheDocument();
    expect(screen.getByText("Teacher")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.getByText("Unknown speaker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play from 01:01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play from 62:05" })).toBeInTheDocument();
  });

  it("highlights the segments a finding cites and links its note", () => {
    const segs = [segment("s0010", 61_000, "teacher", "One."), segment("s0011", 63_000, "teacher", "Two."), segment("s0012", 65_000, "teacher", "Three.")];
    const { container } = render(
      <TranscriptLines segments={segs} findings={[finding()]} FindingLink={({ children }) => <a href="#f">{children}</a>} />,
    );
    const highlighted = [...container.querySelectorAll("li")].filter((li) => li.querySelector("[style*='background']"));
    expect(highlighted.map((li) => li.id)).toEqual(["seg-s0010", "seg-s0011"]);
    expect(screen.getAllByRole("link", { name: "Synthetic issue text." }).length).toBeGreaterThan(0);
  });
});

import { parseRawTranscript } from "~/lectures/detail";

describe("rule 12: the raw transcript is validated before it is shown", () => {
  const t = { duration_ms: 1000, asr_provider: "x", segments: [{ segment_id: "s0001", start_ms: 0, end_ms: 500, speaker: "teacher", text: "Hi." }] };
  it("accepts a Transcript or the stage artifact that wraps one, and nothing else", () => {
    expect(parseRawTranscript(t).ok).toBe(true);
    expect(parseRawTranscript({ transcript: t, diarization_method: "x", teacher_id_method: "y", warnings: [] }).ok).toBe(true);
    expect(parseRawTranscript({ transcript: { segments: "nope" } }).ok).toBe(false);
    expect(parseRawTranscript(null).ok).toBe(false);
  });
});
