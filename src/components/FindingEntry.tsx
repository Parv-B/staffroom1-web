import type { MouseEvent, ReactNode } from "react";
import type { EvidenceRun, Finding } from "~/analysis/types.gen";
import { aspectLabel } from "~/findings/aspects";
import {
  CATEGORIES,
  SEVERITY_LABEL,
  categoryColours,
} from "~/findings/categories";
import { mmss, timeRange } from "~/lib/format";
import { usePlayer } from "~/media/player";

export interface TranscriptLinkProps {
  startMs: number;
  findingId: string;
  children: ReactNode;
}

interface Props {
  finding: Finding;
  /** Renders the "Read in transcript" link; the transcript route supplies a typed Link. */
  TranscriptLink: (p: TranscriptLinkProps) => ReactNode;
  headingLevel?: 2 | 3 | 4;
}

/** Rule 4: a finding is never shown without its verbatim evidence and both jump links.
 *  Rule 5: content errors lead with intent. Rule 7: model confidences are never displayed. */
export function FindingEntry({
  finding: f,
  TranscriptLink,
  headingLevel = 3,
}: Props) {
  if (f.evidence.length === 0) {
    return (
      <p className="t-small text-slate" role="note">
        A finding at {mmss(f.start_ms)} is hidden because it arrived without its
        evidence.
      </p>
    );
  }
  return <FindingBody finding={f} TranscriptLink={TranscriptLink} headingLevel={headingLevel} />;
}

// Clicks on these keep their own meaning instead of seeking the recording.
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role='button'], [data-no-seek]";

/** The finding's first evidence moment and whether the recording is playing inside any of its
 *  evidence runs right now. */
function useSeek(f: Finding) {
  const player = usePlayer();
  const playable = player?.state.kind === "ready" || player?.state.kind === "loading";
  const startMs = f.evidence[0].start_ms; // FindingEntry renders a finding only with evidence
  const nowPlaying =
    !!player?.playing &&
    f.evidence.some((ev) => player.currentMs >= ev.start_ms && player.currentMs <= ev.end_ms + 2000);
  return { player: playable ? player : null, startMs, nowPlaying };
}

function FindingBody({ finding: f, TranscriptLink, headingLevel }: Required<Props>) {
  const { player, startMs, nowPlaying } = useSeek(f);
  const info = CATEGORIES[f.category];
  const { rule } = categoryColours(f.category);
  const H = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";
  const isContentError = f.category === "content_error";
  const lead = isContentError && f.likely_intent ? f.likely_intent : f.issue;

  // A click anywhere on the finding (outside its links and buttons, and not while selecting
  // text) plays the recording from its first evidence. Keyboard users have the Watch button.
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (!player) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    if ((window.getSelection()?.toString() ?? "") !== "") return;
    player.playFrom(startMs);
  };

  return (
    <article
      className={`measure ${player ? "cursor-pointer" : ""}`}
      aria-labelledby={`${f.finding_id}-claim`}
      data-finding-id={f.finding_id}
      data-now-playing={nowPlaying || undefined}
      onClick={onClick}
    >
      {player ? (
        <p className="t-small nums float-right ml-4 flex items-baseline gap-3">
          {nowPlaying ? (
            <span className="font-semibold text-pen" role="status">
              Now playing
            </span>
          ) : null}
          <button
            type="button"
            className="action"
            onClick={() => {
              player.playFrom(startMs);
            }}
          >
            {player.isVideo ? "Watch" : "Listen"} from {mmss(startMs)}
          </button>
        </p>
      ) : null}
      <p className="t-small font-semibold" style={{ color: rule }}>
        {info.label}
        {info.group === "review" ? `, ${SEVERITY_LABEL[f.severity]}` : null}
        {f.aspect ? (
          <span className="font-normal text-slate">
            {" "}
            · {aspectLabel(f.aspect)}
          </span>
        ) : null}
        {(f.occurrences ?? 1) > 1 ? (
          <span className="font-normal text-slate">
            {" "}
            · seen {(f.occurrences ?? 1).toString()} times in this lesson
          </span>
        ) : null}
      </p>
      <H id={`${f.finding_id}-claim`} className="t-subheading mt-1 text-ink">
        {isContentError && f.likely_intent ? (
          <span className="sr-only">Likely intent: </span>
        ) : null}
        {lead}
      </H>

      <div className="mt-3 space-y-4">
        {f.evidence.map((ev) => (
          <Evidence
            key={ev.segment_ids[0]}
            run={ev}
            findingId={f.finding_id}
            rule={rule}
            TranscriptLink={TranscriptLink}
          />
        ))}
      </div>

      <dl className="t-reading mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(9rem,auto)_1fr]">
        {isContentError ? (
          <>
            <Row
              term="What the phrasing implies"
              text={f.what_the_phrasing_implies}
            />
            <Row term="Correction" text={f.suggestion} />
            <Row
              term="Suggested rephrasing"
              text={f.suggested_rephrasing}
              quote
            />
            {f.likely_intent ? (
              <Row term="What was noticed" text={f.issue} />
            ) : null}
            <Row term="Why it matters" text={f.why_it_matters} />
          </>
        ) : (
          <>
            <Row term="Likely intent" text={f.likely_intent} />
            <Row
              term="What the phrasing implies"
              text={f.what_the_phrasing_implies}
            />
            <Row term="Why it matters" text={f.why_it_matters} />
            <Row term="Suggestion" text={f.suggestion} />
            <Row
              term="Suggested rephrasing"
              text={f.suggested_rephrasing}
              quote
            />
          </>
        )}
      </dl>
    </article>
  );
}

function Row({
  term,
  text,
  quote = false,
}: {
  term: string;
  text: string | null | undefined;
  quote?: boolean;
}) {
  if (!text) return null;
  return (
    <>
      <dt className="t-small pt-1 font-semibold text-slate">{term}</dt>
      <dd className="m-0">{quote ? <q>{text}</q> : text}</dd>
    </>
  );
}

function Evidence({
  run,
  findingId,
  rule,
  TranscriptLink,
}: {
  run: EvidenceRun;
  findingId: string;
  rule: string;
  TranscriptLink: Props["TranscriptLink"];
}) {
  const player = usePlayer();
  const playable =
    player?.state.kind === "ready" || player?.state.kind === "loading";
  return (
    <figure className="m-0">
      <blockquote
        className="t-reading m-0 border-l-[3px] py-0.5 pl-4 text-ink"
        style={{ borderColor: rule }}
      >
        <p className="m-0">“{run.quote}”</p>
      </blockquote>
      <figcaption className="t-small nums mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-[calc(1rem+3px)] text-slate">
        <span>{timeRange(run.start_ms, run.end_ms)}</span>
        {playable ? (
          <button
            type="button"
            className="action"
            onClick={() => {
              player.playFrom(run.start_ms);
            }}
          >
            Play from {mmss(run.start_ms)}
          </button>
        ) : (
          <span>{player ? "Recording not available" : null}</span>
        )}
        <TranscriptLink startMs={run.start_ms} findingId={findingId}>
          Read in transcript
        </TranscriptLink>
      </figcaption>
    </figure>
  );
}
