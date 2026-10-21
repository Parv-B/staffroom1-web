import { createFileRoute, redirect } from "@tanstack/react-router";
import { lectureDetailQuery } from "~/lectures/detail";

// A lecture opens on its analysis when there is one, otherwise on its processing status.
export const Route = createFileRoute("/_app/lectures/$lectureId/")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.query(lectureDetailQuery(params.lectureId)).catch(() => null);
    if (d?.status === "done") throw redirect({ to: "/lectures/$lectureId/analysis/overview", params, replace: true });
    throw redirect({ to: "/lectures/$lectureId/status", params, replace: true });
  },
});
