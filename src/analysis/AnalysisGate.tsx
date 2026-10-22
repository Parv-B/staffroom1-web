import { createContext, use, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { isApiError } from "~/api/client";
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
export function AnalysisGate({ lectureId, children }: { lectureId: string; children: ReactNode }) {
  const q = useQuery(analysisQuery(lectureId));
  if (q.isPending) return <p className="t-reading py-8 text-slate">Loading the analysis</p>;
  if (q.isError) {
    const e = q.error;
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

