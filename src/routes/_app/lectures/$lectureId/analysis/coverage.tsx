import { createFileRoute } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { CoverageView } from "~/analysis/CoverageView";
import { MomentLink } from "~/analysis/links";
import { SectionOrReason, segmentIndex } from "~/analysis/sections";
import { PlayerBar } from "~/media/player";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis/coverage")({
  component: Coverage,
});

function Coverage() {
  const { lectureId } = Route.useParams();
  const a = useAnalysis();
  return (
    <div className="pt-2">
      <PlayerBar />
      <h2 className="t-heading pt-4">Objectives covered</h2>
      <div className="mt-4">
        <SectionOrReason a={a} section="coverage">
          {a.coverage ? (
            <CoverageView
              coverage={a.coverage}
              segments={segmentIndex(a)}
              Moment={({ startMs, children }) => (
                <MomentLink lectureId={lectureId} startMs={startMs}>
                  {children}
                </MomentLink>
              )}
            />
          ) : null}
        </SectionOrReason>
      </div>
    </div>
  );
}
