import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AnalysisGate } from "~/analysis/AnalysisGate";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis")({
  component: AnalysisLayout,
});

function AnalysisLayout() {
  const { lectureId } = Route.useParams();
  return (
    <AnalysisGate lectureId={lectureId}>
      <Outlet />
    </AnalysisGate>
  );
}
