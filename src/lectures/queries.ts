import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import type { LectureStatus } from "./vocab";

export const PAGE_SIZE = 20;

export interface LectureListFilters {
  status?: LectureStatus;
  teacher?: string;
  page?: number;
}

export const lectureListQuery = (f: LectureListFilters) =>
  queryOptions({
    queryKey: ["lectures", "list", f],
    queryFn: () =>
      unwrap(
        api.GET("/lectures", {
          params: {
            query: {
              limit: PAGE_SIZE,
              offset: ((f.page ?? 1) - 1) * PAGE_SIZE,
              ...(f.status ? { status: f.status } : {}),
              ...(f.teacher ? { teacher_user_id: f.teacher } : {}),
            },
          },
        }),
      ),
    // Lectures in progress change status; keep the list reasonably fresh.
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.status === "queued" || i.status === "running") ? 15_000 : false),
  });

/** Clears the "New results" mark for the signed-in user. */
export function markSeen(lectureId: string) {
  return unwrap(api.POST("/lectures/{lecture_id}/seen", { params: { path: { lecture_id: lectureId } } }));
}
