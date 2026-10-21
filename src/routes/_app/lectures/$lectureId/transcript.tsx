import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Label, RadioButton, RadioField, RadioGroup } from "react-aria-components";
import { AnalysisGate, useAnalysis } from "~/analysis/AnalysisGate";
import { makeFindingLink } from "~/analysis/links";
import { InvalidDocumentError } from "~/analysis/parse";
import type { Segment } from "~/analysis/types.gen";
import { isApiError } from "~/api/client";
import type { Me } from "~/auth/session";
import { TranscriptLines } from "~/components/TranscriptLines";
import { lectureDetailQuery, rawTranscriptQuery } from "~/lectures/detail";
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
  const { me } = Route.useRouteContext();
  return (
    <AnalysisGate lectureId={lectureId} role={me.role}>
      <Transcript lectureId={lectureId} me={me} />
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

function Transcript({ lectureId, me }: { lectureId: string; me: Me }) {
  const a = useAnalysis();
  const { t, finding } = Route.useSearch();
  const detail = useQuery(lectureDetailQuery(lectureId));
  // Rule 12: the unredacted transcript only for the lecture's teacher and admins (as the API).
  const mayReadRaw = me.role === "admin" || (me.role === "teacher" && detail.data?.teacher_user_id === me.user_id);
  const [view, setView] = useState<"redacted" | "raw">("redacted");
  const raw = useQuery({ ...rawTranscriptQuery(lectureId), enabled: mayReadRaw && view === "raw" });
  const segments = view === "raw" && raw.data ? raw.data.segments : a.transcript.segments;
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
        {mayReadRaw ? (
          <RadioGroup value={view} onChange={(v) => { setView(v === "raw" ? "raw" : "redacted"); }} orientation="horizontal" className="flex flex-wrap items-center gap-2" data-no-print>
            <Label className="t-small mr-1 font-semibold">Show</Label>
            {(
              [
                ["redacted", "Students' names removed"],
                ["raw", "Original, with names"],
              ] as const
            ).map(([v, label]) => (
              <RadioField key={v} value={v}>
                <RadioButton className="t-small inline-block cursor-pointer rounded-full border border-slate px-3 py-1 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet">
                  {label}
                </RadioButton>
              </RadioField>
            ))}
          </RadioGroup>
        ) : null}
      </div>
      {view === "raw" ? (
        <p className="t-small measure mb-6 border-l-[3px] border-heather pl-3" role="status">
          {raw.isPending
            ? "Loading the original transcript."
            : raw.isError
              ? isApiError(raw.error) && raw.error.status === 403
                ? "Your role can't read the original transcript."
                : raw.error instanceof InvalidDocumentError
                  ? "The original transcript didn't pass Staffroom1's checks, so it isn't shown. The version with names removed is shown instead."
                  : "The original transcript couldn't be loaded. The version with names removed is shown."
              : "This is the original transcript, with students' names as they were heard. Each time it's opened is recorded. Findings and notes always use the version with names removed."}
        </p>
      ) : null}
      <TranscriptLines segments={segments} findings={a.findings ?? []} FindingLink={FindingLink} />
    </div>
  );
}
