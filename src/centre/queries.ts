import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";
import type { Bucket, CentreFilters, GroupBy, SummaryRange } from "./summary";

function query(range: SummaryRange, filters: CentreFilters) {
  return {
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(filters.subject ? { subject: filters.subject } : {}),
    ...(filters.grade ? { grade: filters.grade } : {}),
    ...(filters.teacher ? { teacher_user_id: filters.teacher } : {}),
  };
}

/** Owner and admin only (teachers get 403). Also the source of teacher names for those roles'
 *  lecture lists. With no range or filters it covers every lecture. */
export const orgSummaryQuery = (range: SummaryRange = {}, filters: CentreFilters = {}, groupBy: GroupBy = "teacher") =>
  queryOptions({
    queryKey: ["org", "summary", range.from ?? null, range.to ?? null, filters.subject ?? null, filters.grade ?? null, filters.teacher ?? null, groupBy],
    queryFn: () => unwrap(api.GET("/org/summary", { params: { query: { ...query(range, filters), group_by: groupBy } } })),
    staleTime: 60_000,
  });

/** The centre's measures per week or month (owner and admin). */
export const orgTrendQuery = (range: SummaryRange, filters: CentreFilters, bucket: Bucket) =>
  queryOptions({
    queryKey: ["org", "trend", range.from ?? null, range.to ?? null, filters.subject ?? null, filters.grade ?? null, filters.teacher ?? null, bucket],
    queryFn: () => unwrap(api.GET("/org/trend", { params: { query: { ...query(range, filters), bucket } } })),
    staleTime: 60_000,
  });
