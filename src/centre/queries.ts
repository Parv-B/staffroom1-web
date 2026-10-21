import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "~/api/client";

/** Owner and admin only (teachers get 403). Also the source of released categories and
 *  teacher names for those roles' lecture lists. */
export const orgSummaryQuery = () =>
  queryOptions({
    queryKey: ["org", "summary"],
    queryFn: () => unwrap(api.GET("/org/summary", {})),
    staleTime: 60_000,
  });
