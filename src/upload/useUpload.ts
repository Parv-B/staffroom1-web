import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PutError } from "./transport";
import type { FormAssist } from "~/lectures/suggest";
import { indexedDbStore, type MetadataDraft, type UploadRecord } from "./store";
import { UploadError, discardUpload, findResumable, runUpload, type Progress } from "./uploader";

export type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; file: File; record: UploadRecord | null; progress: Progress | null; resumed: boolean }
  | { kind: "paused"; file: File; record: UploadRecord; progress: Progress | null }
  | { kind: "failed"; file: File | null; record: UploadRecord | null; message: string; canContinue: boolean }
  | { kind: "completed"; record: UploadRecord };

export function useUpload(userId: string, onResume?: (rec: UploadRecord) => void) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const savedQuery = useQuery({
    queryKey: ["uploads", "saved", userId],
    queryFn: async () => {
      try {
        return (await indexedDbStore.listForUser(userId)).sort((a, b) => b.updatedAt - a.updatedAt);
      } catch {
        return []; // IndexedDB blocked (private window): uploads still work, without resume.
      }
    },
    staleTime: Infinity,
  });
  const saved = savedQuery.data ?? [];
  const refreshSaved = useCallback(() => queryClient.invalidateQueries({ queryKey: ["uploads", "saved", userId] }), [queryClient, userId]);

  // Leaving mid-upload loses the in-flight parts (finished ones stay saved); ask first.
  useEffect(() => {
    if (state.kind !== "uploading") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [state.kind]);

  const start = useCallback(
    async (file: File, resumeFrom?: UploadRecord) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      let resume = resumeFrom;
      if (!resume) {
        try {
          resume = await findResumable(file, userId);
        } catch {
          resume = undefined;
        }
      }
      if (resume) onResume?.(resume);
      let record: UploadRecord | null = resume ?? null;
      let progress: Progress | null = null;
      setState({ kind: "uploading", file, record, progress, resumed: Boolean(resume) });
      try {
        const done = await runUpload({
          file,
          userId,
          ...(resume ? { resume } : {}),
          signal: ac.signal,
          onRecord: (r) => {
            record = r;
            setState((s) => (s.kind === "uploading" ? { ...s, record: r } : s));
          },
          onProgress: (p) => {
            progress = p;
            setState((s) => (s.kind === "uploading" ? { ...s, progress: p } : s));
          },
        });
        setState({ kind: "completed", record: done });
      } catch (e) {
        if (e instanceof PutError && e.kind === "aborted") {
          if (record) setState({ kind: "paused", file, record, progress });
          else setState({ kind: "idle" });
        } else if (e instanceof UploadError) {
          setState({ kind: "failed", file, record, message: e.message, canContinue: e.kind === "stalled" });
        } else {
          setState({
            kind: "failed",
            file,
            record,
            message: "The upload stopped because Staffroom1 couldn't be reached. Check your connection, then continue.",
            canContinue: record !== null,
          });
        }
      } finally {
        void refreshSaved();
      }
    },
    [userId, refreshSaved, onResume],
  );

  const pause = useCallback(() => {
    controller.current?.abort();
  }, []);

  const cancel = useCallback(
    async (rec: UploadRecord | null) => {
      controller.current?.abort();
      if (rec) await discardUpload(rec);
      setState({ kind: "idle" });
      await refreshSaved();
    },
    [refreshSaved],
  );

  /** Re-opens a finished upload saved earlier (e.g. after a refresh on the details form). */
  const reopen = useCallback((rec: UploadRecord) => {
    setState({ kind: "completed", record: rec });
  }, []);

  const saveDraft = useCallback(async (rec: UploadRecord, draft: MetadataDraft, assist?: FormAssist) => {
    try {
      await indexedDbStore.put({ ...rec, draft, ...(assist ? { assist } : {}), updatedAt: Date.now() });
    } catch {
      // Drafts are a convenience; nothing is lost but the draft.
    }
  }, []);

  const forget = useCallback(
    async (rec: UploadRecord) => {
      await indexedDbStore.remove(rec.key);
      await refreshSaved();
    },
    [refreshSaved],
  );

  return { state, saved, start, pause, cancel, reopen, saveDraft, forget };
}
