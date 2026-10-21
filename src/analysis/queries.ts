import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import { parseAnalysis, requireValid } from "./parse";

export const analysisQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "analysis"],
    queryFn: async () => {
      const raw = await unwrap(api.GET("/lectures/{lecture_id}/analysis", { params: { path: { lecture_id: lectureId } } }));
      return requireValid("analysis", parseAnalysis(raw));
    },
    staleTime: 60_000,
  });

export const notesQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "notes"],
    queryFn: () => unwrap(api.GET("/lectures/{lecture_id}/notes", { params: { path: { lecture_id: lectureId } } })),
    staleTime: 30_000,
  });
