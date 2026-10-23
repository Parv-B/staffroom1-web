import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { aspectLabel } from "~/findings/aspects";
import { CATEGORIES, SEVERITY_LABEL } from "~/findings/categories";
import { mmss } from "~/lib/format";
import type { Finding, LectureAnalysis, Severity } from "./types.gen";

const MAX_ISSUES = 3;
const MAX_STRENGTHS = 2;
const SEVERITY_ORDER: Record<Severity, number> = {
  important: 0,
  moderate: 1,
  minor: 2,
  info: 3,
};

/** The teacher summary's picks when there are any, else the most severe, earliest first. */
function pick(
  all: Finding[],
  ids: readonly string[] | undefined,
  max: number,
): Finding[] {
  const byId = new Map(all.map((f) => [f.finding_id, f]));
  const chosen = (ids ?? [])
    .map((id) => byId.get(id))
    .filter((f): f is Finding => f !== undefined);
  if (chosen.length) return chosen.slice(0, max);
  return [...all]
    .sort(
      (p, q) =>
        SEVERITY_ORDER[p.severity] - SEVERITY_ORDER[q.severity] ||
        p.start_ms - q.start_ms,
    )
    .slice(0, max);
}

/** The first sentence of a finding, for a short list. The full text is one click away. */
export function firstSentence(text: string): string {
  const s = text.trim();
  const m = /^(.{20,}?[.!?])\s/.exec(s);
  return m?.[1] ?? s;
}

type MomentFn = (p: { startMs: number; children: ReactNode }) => ReactNode;
type LinkFn = (p: { findingId: string; children: ReactNode }) => ReactNode;

/** "Work on first" and "What worked well": the few findings that matter most, each with its
 *  time, aspect, one sentence and the suggestion on request. */
export function FocusLists({
  a,
  lectureId,
  MomentLink,
  FindingLink,
}: {
  a: LectureAnalysis;
  lectureId: string;
  MomentLink: MomentFn;
  FindingLink: LinkFn;
}) {
  const findings = a.findings ?? [];
  const review = findings.filter(
    (f) => CATEGORIES[f.category].group === "review",
  );
  const worked = findings.filter(
    (f) => CATEGORIES[f.category].group === "worked",
  );
  const s = a.teacher_summary;
  const issues = pick(review, s?.top_findings, MAX_ISSUES);
  const strengths = pick(worked, s?.top_strengths, MAX_STRENGTHS);
  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="work-on-h" data-focus="review">
          <h3 id="work-on-h" className="t-subheading m-0 text-ochre">
            Work on first
          </h3>
          {issues.length ? (
            <ol className="m-0 mt-3 list-none space-y-5 p-0">
              {issues.map((f) => (
                <Item
                  key={f.finding_id}
                  f={f}
                  MomentLink={MomentLink}
                  FindingLink={FindingLink}
                  showSeverity
                />
              ))}
            </ol>
          ) : (
            <p className="t-reading m-0 mt-3">
              Nothing to review was found in this lesson.
            </p>
          )}
        </section>
        <section aria-labelledby="worked-h" data-focus="worked">
          <h3 id="worked-h" className="t-subheading m-0 text-moss">
            What worked well
          </h3>
          {strengths.length ? (
            <ol className="m-0 mt-3 list-none space-y-5 p-0">
              {strengths.map((f) => (
                <Item
                  key={f.finding_id}
                  f={f}
                  MomentLink={MomentLink}
                  FindingLink={FindingLink}
                />
              ))}
            </ol>
          ) : (
            <p className="t-reading m-0 mt-3">
              No strength was singled out in this lesson.
            </p>
          )}
        </section>
      </div>
      <p className="t-small m-0 mt-6">
        <Link
          to="/lectures/$lectureId/analysis/findings"
          params={{ lectureId }}
          className="action"
        >
          {`All ${review.length.toString()} ${review.length === 1 ? "point" : "points"} to review and ${worked.length.toString()} ${worked.length === 1 ? "strength" : "strengths"}, with their evidence`}
        </Link>
      </p>
    </div>
  );
}

function Item({
  f,
  MomentLink,
  FindingLink,
  showSeverity = false,
}: {
  f: Finding;
  MomentLink: MomentFn;
  FindingLink: LinkFn;
  showSeverity?: boolean;
}) {
  const aspect = aspectLabel(f.aspect);
  const category =
    f.category === "shortcoming" || f.category === "strength"
      ? null
      : CATEGORIES[f.category].label;
  const seen = f.occurrences ?? 1;
  return (
    <li data-finding={f.finding_id}>
      <p className="t-small m-0 flex flex-wrap items-baseline gap-x-3 text-slate">
        <span className="nums">
          <MomentLink startMs={f.start_ms}>{mmss(f.start_ms)}</MomentLink>
        </span>
        {category ? (
          <span className="font-semibold text-ink">{category}</span>
        ) : null}
        {aspect ? <span>{aspect}</span> : null}
        {showSeverity ? <span>{SEVERITY_LABEL[f.severity]}</span> : null}
      </p>
      <p className="t-reading m-0 mt-1">
        <FindingLink findingId={f.finding_id}>
          {firstSentence(f.issue)}
        </FindingLink>
      </p>
      {seen > 1 ? (
        <p className="t-small m-0 mt-1 text-slate">
          Seen {seen.toString()} times in this lesson.
        </p>
      ) : null}
      {f.suggestion ? (
        <details className="t-small mt-1">
          <summary className="cursor-pointer text-slate">
            {f.category === "strength" ? "How to build on it" : "Suggestion"}
          </summary>
          <p className="t-reading m-0 mt-1">{f.suggestion}</p>
        </details>
      ) : null}
    </li>
  );
}
