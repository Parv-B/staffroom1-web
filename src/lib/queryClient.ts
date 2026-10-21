import { QueryClient } from "@tanstack/react-query";
import { InvalidDocumentError } from "~/analysis/parse";
import { ApiError } from "~/api/client";
import { subscribe, isSignedIn } from "~/auth/session";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers are decisions (not shared, not found, not ready), not glitches: don't retry.
      // A document that failed schema validation won't pass on a retry either.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && !(err instanceof InvalidDocumentError) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Nothing fetched under one session survives into the next.
subscribe(() => {
  if (!isSignedIn()) queryClient.clear();
});
