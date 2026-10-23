import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import { queryClient } from "~/lib/queryClient";
import { parseAnalysis, requireValid } from "./parse";
import { withTimesInProse } from "./prose";

export const analysisQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "analysis"],
    queryFn: async () => {
      const raw = await unwrap(api.GET("/lectures/{lecture_id}/analysis", { params: { path: { lecture_id: lectureId } } }));
      // Opening the analysis marks its results seen on the server; refresh the cached marks.
      afterAnalysisOpened(lectureId);
      return withTimesInProse(requireValid("analysis", parseAnalysis(raw)));
    },
    staleTime: 60_000,
  });

export const notesQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "notes"],
    queryFn: () => unwrap(api.GET("/lectures/{lecture_id}/notes", { params: { path: { lecture_id: lectureId } } })),
    staleTime: 30_000,
  });

function afterAnalysisOpened(lectureId: string): void {
  queryClient.setQueriesData<{ items: { lecture_id: string; has_unseen_results: boolean }[] }>({ queryKey: ["lectures", "list"] }, (old) =>
    old ? { ...old, items: old.items.map((i) => (i.lecture_id === lectureId ? { ...i, has_unseen_results: false } : i)) } : old,
  );
  queryClient.setQueryData<{ has_unseen_results: boolean }>(["lecture", lectureId, "detail"], (old) => (old ? { ...old, has_unseen_results: false } : old));
}
