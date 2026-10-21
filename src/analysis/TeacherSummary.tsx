import type { ReactNode } from "react";
import { mmss } from "~/lib/format";
import { CATEGORIES } from "~/findings/categories";
import type { LectureAnalysis } from "./types.gen";

/** Rule 10: the summary text exactly as provided, and its top findings and strengths linked to
 *  the findings they name. */
export function TeacherSummary({ a, FindingLink }: { a: LectureAnalysis; FindingLink: (p: { findingId: string; children: ReactNode }) => ReactNode }) {
  const s = a.teacher_summary;
  if (!s) return null;
  const byId = new Map((a.findings ?? []).map((f) => [f.finding_id, f]));
  const linked = [...s.top_findings, ...s.top_strengths];
  return (
    <div className="measure">
      <div className="t-reading whitespace-pre-line" data-summary-text>
        {s.text}
      </div>
      {linked.length > 0 ? (
        <div className="mt-5">
          <h3 className="t-small font-semibold text-slate">The findings named above</h3>
          <ul className="mt-2 list-none space-y-2 p-0">
            {linked.map((id) => {
              const f = byId.get(id);
              if (!f) {
                return (
                  <li key={id} className="t-small text-slate">
                    A finding the summary refers to isn't in this analysis.
                  </li>
                );
              }
              return (
                <li key={id} className="t-ui">
                  <span className="t-small nums mr-2 text-slate">{mmss(f.start_ms)}</span>
                  <span className={`t-small mr-2 font-semibold ${CATEGORIES[f.category].group === "worked" ? "text-moss" : "text-ochre"}`}>{CATEGORIES[f.category].label}</span>
                  <FindingLink findingId={id}>{f.issue}</FindingLink>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
