import type { ReactNode } from "react";
import { mmss } from "~/lib/format";
import type { Coverage, CoverageStatus, Segment } from "./types.gen";

const SOURCE: Readonly<Record<Coverage["objective_source"], string>> = {
  lesson_plan: "These objectives come from the lesson plan and objectives entered with the upload.",
  syllabus: "These objectives come from the chapter's syllabus.",
  model_knowledge: "These objectives were generated from general knowledge of the chapter, not taken from an official syllabus.",
  teacher_stated: "These objectives are the goals the teacher stated during the lesson.",
};

const ORDER: readonly CoverageStatus[] = ["covered", "partial", "not_covered", "deferred"];

export function statusLabel(s: CoverageStatus, notCoveredMeans: Coverage["not_covered_means"]): string {
  switch (s) {
    case "covered":
      return "Covered";
    case "partial":
      return "Partly covered";
    case "deferred":
      return "Left for a later lesson";
    case "not_covered":
      // Rule 8: when objectives aren't the lesson's own, untouched ones are not gaps.
      return notCoveredMeans === "not_in_this_lesson" ? "Not in this lesson" : "Not covered";
  }
}

/** Rule 8: each objective's status with evidence; summary counts exactly as the API gives them
 *  (never recomputed, never a percentage); "not in this lesson" is never presented as a gap;
 *  an unreviewed objective list says so. */
export function CoverageView({
  coverage: c,
  segments,
  Moment,
}: {
  coverage: Coverage;
  segments: ReadonlyMap<string, Segment>;
  Moment: (p: { startMs: number; children: ReactNode }) => ReactNode;
}) {
  const counts = [...ORDER, ...Object.keys(c.summary_counts).filter((k) => !(ORDER as readonly string[]).includes(k))].filter((k) => k in c.summary_counts);
  return (
    <div className="space-y-6">
      <div className="measure space-y-2">
        <p className="t-reading m-0">{SOURCE[c.objective_source]}</p>
        {!c.objectives_reviewed ? (
          <p className="t-small m-0 border-l-[3px] border-heather pl-3" data-unreviewed>
            No one has reviewed this objective list yet. Treat it as a draft: it may miss topics or include ones your board doesn't teach.
          </p>
        ) : null}
        {c.not_covered_means === "not_in_this_lesson" ? (
          <p className="t-small m-0 text-slate">
            One lesson rarely covers a whole chapter, so an objective this lesson didn't reach is marked "not in this lesson", not as
            a gap.
          </p>
        ) : (
          <p className="t-small m-0 text-slate">These are the lesson's own objectives, so one it didn't reach is a gap worth a look.</p>
        )}
        <p className="t-ui nums m-0" data-summary-counts>
          {counts.map((k, i) => (
            <span key={k}>
              {i > 0 ? ", " : ""}
              <span className="font-semibold">{c.summary_counts[k as CoverageStatus]}</span> {statusLabel(k as CoverageStatus, c.not_covered_means).toLowerCase()}
            </span>
          ))}
        </p>
      </div>
      <ol className="m-0 list-none p-0">
        {c.objectives.map((o, i) => {
          const isGap = o.status === "not_covered" && c.not_covered_means === "gap";
          const times = (o.evidence_segment_ids ?? []).map((id) => segments.get(id)).filter((s): s is Segment => s !== undefined);
          return (
            <li key={i} className="grid gap-x-6 gap-y-1 border-t border-slate/25 py-4 md:grid-cols-[11rem_minmax(0,var(--measure))]">
              <p className={`t-small m-0 font-semibold ${o.status === "covered" ? "text-pen" : isGap ? "text-ochre" : "text-slate"}`} data-coverage-status={o.status}>
                {statusLabel(o.status, c.not_covered_means)}
              </p>
              <div>
                <p className="t-reading m-0">{o.objective}</p>
                {times.length > 0 ? (
                  <p className="t-small nums mt-1 flex flex-wrap gap-x-3 text-slate">
                    <span>Heard at</span>
                    {times.map((s) => (
                      <Moment key={s.segment_id} startMs={s.start_ms}>
                        {mmss(s.start_ms)}
                      </Moment>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
