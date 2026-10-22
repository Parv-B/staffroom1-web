import type { ReactNode } from "react";
import {
  ASPECTS,
  LEVEL_LABEL,
  LEVELS,
  type Level,
  levelRank,
  levelTone,
} from "~/findings/aspects";
import { timeRange } from "~/lib/format";
import type { AspectJudgement, LectureAnalysis } from "./types.gen";

const TONE_CLASS = {
  above: "text-moss",
  expected: "text-ink",
  below: "text-ochre",
} as const;

/** Each aspect of the lesson rated on six levels against fixed descriptors, with the cited
 *  evidence, the descriptor it matched, and a next step. `good` is the expected level. */
type LinkFn = (p: { findingId: string; children: ReactNode }) => ReactNode;
type MomentFn = (p: { startMs: number; children: ReactNode }) => ReactNode;

export function LessonProfile({
  a,
  FindingLink,
  MomentLink,
}: {
  a: LectureAnalysis;
  FindingLink: LinkFn;
  MomentLink: MomentFn;
}) {
  const j = a.lesson_judgement;
  if (!j) {
    const reason = a.unavailable?.lesson_judgement;
    return (
      <div
        className="measure border-l-[3px] border-slate/50 py-1 pl-4"
        data-unavailable="lesson_judgement"
      >
        <p className="t-reading m-0">
          The lesson profile isn't available for this lecture.
        </p>
        <p className="t-small mt-1 text-slate">
          {reason
            ? `Reason: ${reason}`
            : "This lecture was analysed before lesson profiles existed; processing it again adds one."}
        </p>
      </div>
    );
  }
  const issues = new Map((a.findings ?? []).map((f) => [f.finding_id, f]));
  const rated = j.aspects.filter((x) => x.level !== null);
  const unrated = j.aspects.filter((x) => x.level === null);
  return (
    <div data-lesson-profile>
      <p className="t-small measure m-0 text-slate">
        Each aspect is rated on six levels, from very weak to outstanding.{" "}
        <span className="font-semibold text-ink">Good</span> is the level
        expected of every lesson. Ratings come from the transcript and the
        findings, and cite the lines they rest on.
      </p>
      <ol className="m-0 mt-4 list-none space-y-0 p-0">
        {rated.map((x) => (
          <AspectRow
            key={x.aspect}
            x={x}
            MomentLink={MomentLink}
            FindingLink={FindingLink}
            issueLabel={(id) => issues.get(id)?.issue ?? null}
          />
        ))}
      </ol>
      {unrated.length > 0 ? (
        <details className="t-small measure mt-4">
          <summary className="cursor-pointer text-slate">
            {unrated.length === 1
              ? "1 aspect"
              : `${unrated.length.toString()} aspects`}{" "}
            couldn't be rated from this recording
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {unrated.map((x) => (
              <li key={x.aspect}>
                <span className="font-semibold">{label(x)}</span>:{" "}
                {x.reason_if_no_level}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function label(x: AspectJudgement): string {
  return ASPECTS.find((a) => a.id === x.aspect)?.label ?? x.aspect;
}

function AspectRow({
  x,
  MomentLink,
  FindingLink,
  issueLabel,
}: {
  x: AspectJudgement;
  MomentLink: MomentFn;
  FindingLink: LinkFn;
  issueLabel: (id: string) => string | null;
}) {
  const level = x.level as Level;
  const tone = levelTone(level);
  return (
    <li
      className="grid gap-x-6 gap-y-2 border-t border-slate/25 py-5 first:border-t-0 md:grid-cols-[minmax(0,16rem)_1fr]"
      data-aspect={x.aspect}
      data-level={level}
    >
      <div>
        <h3 className="t-ui m-0 font-semibold">{label(x)}</h3>
        <p className={`t-ui m-0 mt-1 font-semibold ${TONE_CLASS[tone]}`}>
          {LEVEL_LABEL[level]}
        </p>
        <Scale level={level} />
      </div>
      <div className="t-reading measure space-y-2">
        {x.matched_descriptor ? (
          <p className="m-0 text-slate">{x.matched_descriptor}</p>
        ) : null}
        {x.done_well ? (
          <p className="m-0">
            <span className="t-small font-semibold text-slate">
              Done well:{" "}
            </span>
            {x.done_well}
          </p>
        ) : null}
        {x.next_step ? (
          <p className="m-0">
            <span className="t-small font-semibold text-slate">
              Next step:{" "}
            </span>
            {x.next_step}
          </p>
        ) : null}
        <p className="t-small nums m-0 flex flex-wrap gap-x-4 gap-y-1 text-slate">
          {(x.evidence ?? []).map((ev) => (
            <MomentLink key={ev.segment_ids[0]} startMs={ev.start_ms}>
              {timeRange(ev.start_ms, ev.end_ms)}
            </MomentLink>
          ))}
          {(x.supporting_finding_ids ?? []).map((id) => {
            const text = issueLabel(id);
            return text ? (
              <FindingLink key={id} findingId={id}>
                {truncate(text, 60)}
              </FindingLink>
            ) : null;
          })}
        </p>
      </div>
    </li>
  );
}

/** Six steps, worst to best; filled up to the level, the expected level marked. */
function Scale({ level }: { level: Level }) {
  const rank = levelRank(level);
  const steps = [...LEVELS].reverse();
  return (
    <span className="mt-2 flex items-center gap-1" aria-hidden="true">
      {steps.map((l, i) => {
        const filled = i < rank;
        const expected = l === "good";
        return (
          <span
            key={l}
            className={`inline-block h-2 w-5 rounded-sm ${filled ? (levelTone(level) === "below" ? "bg-ochre" : levelTone(level) === "above" ? "bg-moss" : "bg-ink") : "bg-desk"} ${expected ? "outline outline-1 outline-offset-1 outline-slate" : ""}`}
          />
        );
      })}
    </span>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}
