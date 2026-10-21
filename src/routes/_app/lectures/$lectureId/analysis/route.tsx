import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AnalysisGate } from "~/analysis/AnalysisGate";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis")({
  component: AnalysisLayout,
});

function AnalysisLayout() {
  const { lectureId } = Route.useParams();
  const { me } = Route.useRouteContext();
  return (
    <AnalysisGate lectureId={lectureId} role={me.role}>
      <Outlet />
    </AnalysisGate>
  );
}
