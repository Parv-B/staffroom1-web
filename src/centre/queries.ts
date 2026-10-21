import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import type { SummaryRange } from "./summary";

/** Owner and admin only (teachers get 403). Also the source of teacher names for those roles'
 *  lecture lists. With no range it covers every lecture. */
export const orgSummaryQuery = (range: SummaryRange = {}) =>
  queryOptions({
    queryKey: ["org", "summary", range.from ?? null, range.to ?? null],
    queryFn: () => unwrap(api.GET("/org/summary", { params: { query: { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) } } })),
    staleTime: 60_000,
  });
