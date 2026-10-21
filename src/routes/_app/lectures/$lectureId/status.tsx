import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Dialog, DialogTrigger, Heading, Label, ListBox, ListBoxItem, Modal, Popover, Select, SelectValue } from "react-aria-components";
import { isApiError } from "~/api/client";
import { estimateQuery, isInProgress, lectureDetailQuery, rerun, type LectureDetail } from "~/lectures/detail";
import { STAGES } from "~/lectures/stages";
import { StatusView, type EstimateState } from "~/lectures/StatusView";

export const Route = createFileRoute("/_app/lectures/$lectureId/status")({
  // After a details edit: which parts are being worked out again (from the API's answer).
  validateSearch: (s: Record<string, unknown>): { edited?: string } => (typeof s.edited === "string" && s.edited.length < 300 ? { edited: s.edited } : {}),
  component: StatusPage,
});

function StatusPage() {
  const { lectureId } = Route.useParams();
  const { me } = Route.useRouteContext();
  const { edited } = Route.useSearch();
  const detail = useQuery(lectureDetailQuery(lectureId));
  const d = detail.data;
  const inProgress = d ? isInProgress(d.status) : false;
  const durationMs = d?.duration_ms ?? null;
  const est = useQuery({ ...estimateQuery(durationMs ?? 1), enabled: inProgress && durationMs !== null });
  const now = useNow(inProgress);
  if (!d) return null;

  const estimate: EstimateState =
    durationMs === null ? { kind: "no-duration" } : est.data ? { kind: "ready", estimate: est.data } : est.isError ? { kind: "error" } : { kind: "loading" };
  const canRerun = me.role === "admin" || (me.role === "teacher" && d.teacher_user_id === me.user_id);
  return (
    <section aria-labelledby="status-heading" className="pt-6">
      <h2 id="status-heading" className="t-heading">
        Processing
      </h2>
      {edited ? (
        <p className="t-small measure mt-3 border-l-[3px] border-pen py-1 pl-3" role="status">
          Details saved. Being worked out again: {edited}.
        </p>
      ) : null}
      <div className="mt-4">
        <StatusView detail={d} role={me.role} estimate={estimate} now={now} />
      </div>
      {canRerun && !inProgress ? <Rerun detail={d} /> : null}
    </section>
  );
}

/** A clock for the estimate between polls; ticks only while processing. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      window.clearInterval(t);
    };
  }, [active]);
  return now;
}

function Rerun({ detail: d }: { detail: LectureDetail }) {
  const queryClient = useQueryClient();
  const failedStage = d.stages.find((s) => s.status === "failed")?.stage ?? null;
  const [from, setFrom] = useState<string>(failedStage ?? "start");
  const run = useMutation({
    mutationFn: () => rerun(d.lecture_id, from === "start" ? null : from),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lecture", d.lecture_id] }),
  });
  return (
    <div className="measure mt-10 border-t border-slate/25 pt-6">
      <h3 className="t-subheading">Process this lecture again</h3>
      <p className="t-reading mt-2">
        {d.status === "failed"
          ? "Running it again usually gets past a temporary problem. Steps that already finished are reused when nothing they depend on changed."
          : "Do this if the recording or the analysis settings have changed. The new analysis replaces this one. Lecture notes the teacher has edited are kept."}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Select value={from} onChange={(k) => { if (k !== null) setFrom(String(k)); }} className="flex flex-col gap-1.5">
          <Label className="t-small font-semibold">Start from</Label>
          <Button className="t-ui flex min-w-72 items-center justify-between gap-3 rounded-[3px] border border-slate bg-sheet px-3 py-2 text-left">
            <SelectValue />
            <span aria-hidden="true">▾</span>
          </Button>
          <Popover className="min-w-[--trigger-width] border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
            <ListBox className="t-ui max-h-80 overflow-auto outline-none">
              <ListBoxItem id="start" className="cursor-pointer px-3 py-1.5 outline-none data-[focused]:bg-pen-tint data-[selected]:font-semibold">
                The beginning
              </ListBoxItem>
              {STAGES.map(([stage, label], i) => (
                <ListBoxItem key={stage} id={stage} textValue={label} className="cursor-pointer px-3 py-1.5 outline-none data-[focused]:bg-pen-tint data-[selected]:font-semibold">
                  {i + 1}. {label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <DialogTrigger>
          <Button className="button" data-variant="primary" isDisabled={run.isPending}>
            Process again
          </Button>
          <Modal isDismissable className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
            <Dialog className="max-w-md bg-sheet p-6 outline-none">
              {({ close }) => (
                <>
                  <Heading slot="title" className="t-subheading">
                    Process this lecture again?
                  </Heading>
                  <p className="t-reading mt-2">
                    The analysis is rebuilt{from === "start" ? " from the beginning" : ""}. Until it finishes, the lecture shows as processing.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <Button
                      className="button"
                      data-variant="primary"
                      onPress={() => {
                        run.mutate();
                        close();
                      }}
                    >
                      Process again
                    </Button>
                    <Button className="button" onPress={close}>
                      Keep the current analysis
                    </Button>
                  </div>
                </>
              )}
            </Dialog>
          </Modal>
        </DialogTrigger>
      </div>
      <div aria-live="polite" className="mt-3">
        {run.isSuccess ? <p className="t-small">Queued. This page will show the progress.</p> : null}
        {run.isError ? (
          <p className="t-small border-l-[3px] border-ink pl-3" role="alert">
            {isApiError(run.error, "already_queued")
              ? "It's already queued or processing. Wait for that run to finish."
              : isApiError(run.error, "no_media")
                ? "The recording is no longer stored, so this lecture can't be processed again."
                : "It wasn't queued because Staffroom1 couldn't be reached. Try again."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
