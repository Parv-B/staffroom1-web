import { createContext, use, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { isApiError } from "~/api/client";
import type { Role } from "~/auth/session";
import { FindingCounts } from "~/components/FindingCounts";
import { MetricValue } from "~/components/MetricValue";
import { lectureDetailQuery } from "~/lectures/detail";
import { metricLabel } from "~/metrics/labels";
import { fromBrief } from "~/metrics/reading";
import { InvalidDocumentError } from "./parse";
import { analysisQuery } from "./queries";
import type { LectureAnalysis } from "./types.gen";

const AnalysisContext = createContext<LectureAnalysis | null>(null);

/** The validated analysis; only usable under <AnalysisGate>. */
export function useAnalysis(): LectureAnalysis {
  const a = use(AnalysisContext);
  if (!a) throw new Error("useAnalysis outside AnalysisGate");
  return a;
}

/** Loads the analysis and turns every way it can be unavailable into a calm, specific state.
 *  An analysis that fails schema validation is never rendered (no guessed values). */
export function AnalysisGate({ lectureId, role, children }: { lectureId: string; role: Role; children: ReactNode }) {
  const q = useQuery(analysisQuery(lectureId));
  if (q.isPending) return <p className="t-reading py-8 text-slate">Loading the analysis</p>;
  if (q.isError) {
    const e = q.error;
    if (isApiError(e, "not_shared")) return <NotShared lectureId={lectureId} role={role} />;
    return (
      <div className="measure py-8" role="alert">
        <p className="t-reading m-0">{message(e)}</p>
        {isApiError(e, "analysis_not_ready") ? (
          <p className="t-reading mt-3">
            <Link to="/lectures/$lectureId/status" params={{ lectureId }} className="action">
              See the processing status
            </Link>
          </p>
        ) : null}
      </div>
    );
  }
  return <AnalysisContext value={q.data}>{children}</AnalysisContext>;
}

function message(e: Error): string {
  if (e instanceof InvalidDocumentError) {
    return "This analysis didn't pass the checks Staffroom1 runs before showing anything, so none of it is shown. An admin can process the lecture again.";
  }
  if (isApiError(e, "analysis_not_ready")) return "The analysis isn't ready yet.";
  if (isApiError(e, "artifact_missing")) return "The stored analysis can't be found. An admin can process the lecture again to rebuild it.";
  if (isApiError(e) && e.status === 404) return "This lecture doesn't exist, or it isn't one you can see.";
  if (isApiError(e) && e.status === 403) return "Your role can't open this analysis.";
  return "The analysis couldn't be loaded. Check your connection, then reload the page.";
}

const KEY = ["student_talk_share", "teacher_question_count", "wait_time_median_s", "teacher_wpm"] as const;

/** Owners see a lecture's counts and measures whatever the sharing, and nothing else. */
function NotShared({ lectureId }: { lectureId: string; role: Role }) {
  const detail = useQuery(lectureDetailQuery(lectureId));
  const d = detail.data;
  return (
    <div className="space-y-6 py-8">
      <div className="measure">
        <h2 className="t-subheading">The teacher hasn't shared this analysis</h2>
        <p className="t-reading mt-2">
          Feedback on a lesson is private to its teacher until they choose to share it. You can still see the finding counts and
          measures below, as you can for every lecture in the centre.
        </p>
      </div>
      {d ? (
        <div className="grid max-w-5xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <h3 className="t-small font-semibold text-slate">Findings</h3>
            <FindingCounts counts={d.findings_summary} released={d.released_categories ?? null} />
          </div>
          <div>
            <h3 className="t-small font-semibold text-slate">Key measures</h3>
            <dl className="mt-1 space-y-1.5">
              {KEY.map((name) => {
                const b = d.metrics_summary?.[name];
                return (
                  <div key={name} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3">
                    <dt className="t-small text-slate">{metricLabel(name)}</dt>
                    <dd className="m-0">
                      {b ? <MetricValue layout="stacked" reading={fromBrief(name, b)} /> : <span className="t-small text-slate">Not computed</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
