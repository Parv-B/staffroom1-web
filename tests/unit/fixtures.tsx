// Synthetic data only: no real transcript text in the repo.
import type { ReactNode } from "react";
import type { Finding, Segment } from "~/analysis/types.gen";
import type { TranscriptLinkProps } from "~/components/FindingEntry";
import { PlayerContext, type PlayerApi } from "~/media/player";

export function finding(over: Partial<Finding> = {}): Finding {
  return {
    finding_id: "f_0123456789abcdef",
    category: "pedagogy",
    severity: "moderate",
    evidence: [{ segment_ids: ["s0010", "s0011"], start_ms: 61_000, end_ms: 70_500, quote: "Synthetic quote for the test." }],
    segment_ids: ["s0010", "s0011"],
    start_ms: 61_000,
    end_ms: 70_500,
    quote: "Synthetic quote for the test.",
    issue: "Synthetic issue text.",
    detector_confidence: 0.87,
    verifier_verdict: "confirmed",
    verifier_confidence: 0.93,
    verifier_rationale: "Synthetic rationale.",
    ...over,
  };
}

export function segment(id: string, startMs: number, speaker: Segment["speaker"], text: string): Segment {
  return { segment_id: id, start_ms: startMs, end_ms: startMs + 2000, speaker, text };
}

export const playFrom: number[] = [];
const fakePlayer: PlayerApi = {
  state: { kind: "ready" },
  playing: false,
  currentMs: 0,
  durationMs: 3_600_000,
  playFrom: (ms) => {
    playFrom.push(ms);
  },
  toggle: () => undefined,
  seek: () => undefined,
};

export function WithPlayer({ children }: { children: ReactNode }) {
  return <PlayerContext value={fakePlayer}>{children}</PlayerContext>;
}

export function TranscriptLinkStub({ startMs, findingId, children }: TranscriptLinkProps) {
  return <a href={`/transcript?t=${startMs.toString()}&finding=${findingId}`}>{children}</a>;
}

import type { LectureAnalysis } from "~/analysis/types.gen";

export function analysis(over: Partial<LectureAnalysis> = {}): LectureAnalysis {
  return {
    lecture_id: "lec_0123456789abcdef",
    created_at: "2026-10-21T10:00:00Z",
    pipeline_version: "test",
    metadata: { board: "CBSE", grade: "10", subject: "Mathematics", chapter: "Synthetic chapter", class_type: "online", class_composition: "unknown", duration_ms: 3_600_000 },
    quality: { asr_provider: "test", diarization_method: "test", teacher_id_method: "test", names_redacted: false, warnings: [] },
    transcript: { duration_ms: 3_600_000, asr_provider: "test", segments: [segment("s0010", 61_000, "teacher", "One."), segment("s0011", 63_000, "teacher", "Two.")] },
    ...over,
  };
}
