import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnalysisGate, useAnalysis } from "~/analysis/AnalysisGate";
import { makeFindingLink } from "~/analysis/links";
import type { Segment } from "~/analysis/types.gen";
import { TranscriptLines } from "~/components/TranscriptLines";
import { mmss } from "~/lib/format";
import { PlayerBar, usePlayer } from "~/media/player";

export const Route = createFileRoute("/_app/lectures/$lectureId/transcript")({
  validateSearch: (s: Record<string, unknown>): { t?: number; finding?: string } => ({
    ...(typeof s.t === "number" && Number.isFinite(s.t) && s.t >= 0 ? { t: Math.floor(s.t) } : {}),
    ...(typeof s.finding === "string" && /^f_[0-9a-f]{16}$/.test(s.finding) ? { finding: s.finding } : {}),
  }),
  component: TranscriptPage,
});

function TranscriptPage() {
  const { lectureId } = Route.useParams();
  return (
    <AnalysisGate lectureId={lectureId}>
      <Transcript lectureId={lectureId} />
    </AnalysisGate>
  );
}

/** The segment playing or starting at `t`: the last one that starts at or before it. */
function segmentAt(segments: readonly Segment[], t: number): Segment | undefined {
  let found: Segment | undefined;
  for (const s of segments) {
    if (s.start_ms <= t) found = s;
    else break;
  }
  return found ?? segments[0];
}

function Transcript({ lectureId }: { lectureId: string }) {
  const a = useAnalysis();
  const { t, finding } = Route.useSearch();
  const segments = a.transcript.segments;
  const FindingLink = makeFindingLink(lectureId);
  const player = usePlayer();
  const seek = player?.seek;

  // Jump once per arrival at a moment, not again on every re-render while the audio plays. It
  // waits two frames so the router's own scroll handling for the navigation has finished.
  const jumpedFor = useRef<string | null>(null);
  useEffect(() => {
    if (t === undefined) return;
    const key = `${t.toString()}|${finding ?? ""}`;
    if (jumpedFor.current === key) return;
    const s = segmentAt(a.transcript.segments, t);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const el = s ? document.getElementById(`seg-${s.segment_id}`) : null;
        if (!el) return;
        jumpedFor.current = key;
        el.scrollIntoView({ block: "start" });
        el.classList.add("just-landed");
        // Cue the recording to the same moment (paused), so Play starts where you landed.
        if (s) seek?.(s.start_ms);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [t, finding, a.transcript.segments, seek]);

  return (
    <div className="pt-2">
      <PlayerBar />
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4 pb-6">
        <p className="t-small measure m-0 text-slate">
          {a.transcript.segments.length} lines, {mmss(a.transcript.duration_ms)} long. Times play the recording from that moment; tinted
          passages are the evidence for a finding.
        </p>
      </div>
      <TranscriptLines
        segments={segments}
        findings={a.findings ?? []}
        FindingLink={FindingLink}
        board={a.board?.frames.length ? { lectureId, frames: a.board.frames } : undefined}
      />
    </div>
  );
}
