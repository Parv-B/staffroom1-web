import type { ReactNode } from "react";
import type { Finding, Segment, Speaker } from "~/analysis/types.gen";
import { CATEGORIES, categoryColours } from "~/findings/categories";
import { mmss } from "~/lib/format";
import { usePlayer } from "~/media/player";

export const SPEAKER_LABEL: Readonly<Record<Speaker, string>> = {
  teacher: "Teacher",
  student: "Student",
  unknown: "Unknown speaker",
};

interface Props {
  segments: readonly Segment[];
  findings: readonly Finding[];
  /** Renders the margin note's link back to the finding. */
  FindingLink: (p: { findingId: string; children: ReactNode }) => ReactNode;
}

/** Rule 12: speaker and time on every line; findings highlighted in place. Text is rendered
 *  exactly as the API gives it ([student] stays [student]). */
export function TranscriptLines({ segments, findings, FindingLink }: Props) {
  const player = usePlayer();
  const bySegment = new Map<string, Finding>();
  // The note hangs beside a passage's first line in the margin (wide screens) and follows its
  // last line (narrow screens), so it never splits the passage.
  const firstSegment = new Set<string>();
  const lastSegment = new Set<string>();
  for (const f of findings) {
    for (const ev of f.evidence) {
      ev.segment_ids.forEach((id, i) => {
        if (!bySegment.has(id)) bySegment.set(id, f);
        if (i === 0) firstSegment.add(`${f.finding_id}:${id}`);
        if (i === ev.segment_ids.length - 1) lastSegment.add(`${f.finding_id}:${id}`);
      });
    }
  }
  return (
    <ol className="m-0 list-none p-0">
      {segments.map((s) => {
        const f = bySegment.get(s.segment_id);
        const c = f ? categoryColours(f.category) : null;
        const opensFinding = f ? firstSegment.has(`${f.finding_id}:${s.segment_id}`) : false;
        const closesFinding = f ? lastSegment.has(`${f.finding_id}:${s.segment_id}`) : false;
        return (
          <li
            key={s.segment_id}
            id={`seg-${s.segment_id}`}
            data-scroll-target
            data-start-ms={s.start_ms}
            className="grid grid-cols-[3.75rem_1fr] gap-x-4 lg:grid-cols-[3.75rem_minmax(0,var(--measure))_14rem] lg:gap-x-6"
          >
            <div className="t-small nums pt-[0.3rem] text-right">
              {player && player.state.kind !== "unavailable" ? (
                <button
                  type="button"
                  className="action"
                  aria-label={`Play from ${mmss(s.start_ms)}`}
                  onClick={() => {
                    player.playFrom(s.start_ms);
                  }}
                >
                  {mmss(s.start_ms)}
                </button>
              ) : (
                <span className="text-slate">{mmss(s.start_ms)}</span>
              )}
            </div>
            <div
              className="border-l-[3px] py-1 pl-3"
              style={c ? { borderColor: c.rule, background: c.tint } : { borderColor: "transparent" }}
            >
              <span className={`t-small mr-2 font-semibold ${s.speaker === "teacher" ? "text-ink" : "text-slate"}`}>
                {SPEAKER_LABEL[s.speaker]}
              </span>
              <span className="t-transcript" lang="en">
                {s.text}
              </span>
            </div>
            {/* On wide screens the note hangs in the margin without changing the row's height. */}
            <div className="col-start-2 lg:relative lg:col-start-3">
              {f && (opensFinding || closesFinding) ? (
                <p
                  className={`t-small mt-1 mb-2 lg:absolute lg:inset-x-0 lg:top-1.5 lg:m-0 ${opensFinding ? "" : "lg:hidden"} ${closesFinding ? "" : "max-lg:hidden"}`}
                  style={{ color: c?.rule }}
                >
                  <span className="font-semibold">{CATEGORIES[f.category].label}.</span>{" "}
                  <FindingLink findingId={f.finding_id}>
                    <span className="text-ink">{f.issue}</span>
                  </FindingLink>
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
