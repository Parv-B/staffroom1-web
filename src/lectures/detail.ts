import { queryOptions } from "@tanstack/react-query";
import { api, unwrap, type Schemas } from "~/api/client";
import { parseTranscript, requireValid, type Parsed } from "~/analysis/parse";
import type { Transcript } from "~/analysis/types.gen";

/** `?raw=true` returns the transcript stage's artifact (docs/api.md), which wraps the Transcript
 *  as `.transcript`; `?raw=false` returns the Transcript itself. Accept either, both validated
 *  against the schema (FRONTEND_REQUESTS.md #4). */
export function parseRawTranscript(payload: unknown): Parsed<Transcript> {
  const direct = parseTranscript(payload);
  if (direct.ok) return direct;
  if (typeof payload === "object" && payload !== null && "transcript" in payload) {
    const inner = parseTranscript(payload.transcript);
    if (inner.ok) return inner;
  }
  return direct;
}

export type LectureDetail = Schemas["LectureDetail"];
export type StageOut = Schemas["StageOut"];

export const POLL_MS = 5_000;

export function isInProgress(status: Schemas["LectureStatus"]): boolean {
  return status === "queued" || status === "running" || status === "awaiting_upload";
}

export const lectureDetailQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "detail"],
    queryFn: () => unwrap(api.GET("/lectures/{lecture_id}", { params: { path: { lecture_id: lectureId } } })),
    refetchInterval: (q) => (q.state.data && isInProgress(q.state.data.status) ? POLL_MS : false),
    refetchIntervalInBackground: false,
  });

export const estimateQuery = (durationMs: number) =>
  queryOptions({
    queryKey: ["processing-estimate", durationMs],
    queryFn: () => unwrap(api.GET("/lectures/processing-estimate", { params: { query: { duration_ms: durationMs } } })),
    staleTime: 5 * 60_000,
  });

export const rawTranscriptQuery = (lectureId: string) =>
  queryOptions({
    queryKey: ["lecture", lectureId, "transcript", "raw"],
    queryFn: async () => {
      const out = await unwrap(api.GET("/lectures/{lecture_id}/transcript", { params: { path: { lecture_id: lectureId }, query: { raw: true } } }));
      return requireValid("transcript", parseRawTranscript(out.transcript));
    },
    staleTime: Infinity,
    gcTime: 60_000, // don't keep unredacted text around longer than needed
  });

export const feedbackQuery = (findingId: string) =>
  queryOptions({
    queryKey: ["finding", findingId, "feedback"],
    queryFn: () => unwrap(api.GET("/findings/{finding_id}/feedback", { params: { path: { finding_id: findingId } } })),
  });

export function setShared(lectureId: string, shared: boolean) {
  return unwrap(api.POST("/lectures/{lecture_id}/share", { params: { path: { lecture_id: lectureId } }, body: { shared } }));
}

export function rerun(lectureId: string, fromStage: string | null) {
  return unwrap(
    api.POST("/lectures/{lecture_id}/rerun", { params: { path: { lecture_id: lectureId }, query: fromStage ? { from_stage: fromStage } : {} } }),
  );
}

export function giveFeedback(findingId: string, verdict: Schemas["FeedbackVerdict"], comment: string | null) {
  return unwrap(api.POST("/findings/{finding_id}/feedback", { params: { path: { finding_id: findingId } }, body: { verdict, comment } }));
}
