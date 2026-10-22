import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { Button, Dialog, Modal, ModalOverlay } from "react-aria-components";
import { AnalysisGate, useAnalysis } from "~/analysis/AnalysisGate";
import { notesQuery } from "~/analysis/queries";
import { segmentIndex } from "~/analysis/sections";
import { isApiError } from "~/api/client";
import type { Me } from "~/auth/session";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { lectureDetailQuery } from "~/lectures/detail";
import { useMediaQuery } from "~/lib/useMediaQuery";
import { PlayerBar } from "~/media/player";
import { approveNotes, downloadMarkdown, saveNotes } from "~/notes/api";
import { CitationPanel, type ActiveBullet } from "~/notes/CitationPanel";
import { NotesEditor } from "~/notes/NotesEditor";
import { NotesReading, NotesStatus } from "~/notes/NotesView";
import {
  checkDraft,
  dropApiProblemsFor,
  emptySection,
  isChanged,
  placeApiProblems,
  problemPlaces,
  toDraft,
  toNotesIn,
  toggleCitation,
  type Draft,
  type NotesOut,
  type Problem,
} from "~/notes/model";

export const Route = createFileRoute("/_app/lectures/$lectureId/notes")({
  component: NotesPage,
});

function NotesPage() {
  const { lectureId } = Route.useParams();
  const { me } = Route.useRouteContext();
  return (
    <AnalysisGate lectureId={lectureId}>
      <Notes lectureId={lectureId} me={me} />
    </AnalysisGate>
  );
}

type Flash = { kind: "ok" | "problem"; text: string } | null;

function Notes({ lectureId, me }: { lectureId: string; me: Me }) {
  const a = useAnalysis();
  const detail = useQuery(lectureDetailQuery(lectureId));
  const notes = useQuery(notesQuery(lectureId));
  const queryClient = useQueryClient();
  const segmentsById = useMemo(() => segmentIndex(a), [a]);
  // Only the lecture's own teacher edits or approves (admins and owners read).
  const canEdit = me.role === "teacher" && detail.data?.teacher_user_id === me.user_id;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [approveProblems, setApproveProblems] = useState<Problem[]>([]);

  const download = useMutation({ mutationFn: () => downloadMarkdown(lectureId) });
  const approve = useMutation({
    mutationFn: () => approveNotes(lectureId),
    onSuccess: (out) => {
      queryClient.setQueryData(notesQuery(lectureId).queryKey, out);
      void queryClient.invalidateQueries({ queryKey: ["lecture", lectureId, "analysis"] });
      setApproveProblems([]);
      setFlash({ kind: "ok", text: "Notes approved." });
    },
    onError: (e: Error) => {
      if (isApiError(e) && e.code === "invalid_notes" && notes.data) {
        // Shown on the bullets themselves, in the editor.
        const d = toDraft(notes.data.sections);
        setDraft(d);
        setApproveProblems(placeApiProblems(e.fields, d));
      }
      setFlash({ kind: "problem", text: approveError(e) });
    },
  });

  if (notes.isPending) return <p className="t-reading py-8 text-slate">Loading the notes</p>;
  if (notes.isError) {
    const e = notes.error;
    if (canEdit && isApiError(e, "notes_unavailable") && draft === null) {
      return (
        <div className="measure py-8">
          <h2 className="t-subheading m-0">There are no notes for this lecture yet</h2>
          <p className="t-reading mt-2">Staffroom1 didn't write notes for this lecture. You can write them yourself, citing the transcript lines each point comes from.</p>
          <Button
            className="button mt-4"
            data-variant="primary"
            onPress={() => {
              setDraft([emptySection()]);
            }}
          >
            Write notes
          </Button>
        </div>
      );
    }
    if (!(canEdit && draft !== null)) {
      return (
        <div className="measure py-8" role={isApiError(e, "notes_unavailable") ? undefined : "alert"}>
          <p className="t-reading m-0">{notesError(e)}</p>
        </div>
      );
    }
  }

  const current: NotesOut | undefined = notes.data;
  const editing = canEdit && draft !== null;

  return (
    <div className="pt-2">
      <PlayerBar />
      {editing ? (
        <EditMode
          lectureId={lectureId}
          initial={draft}
          base={current ?? null}
          initialProblems={approveProblems}
          segments={a.transcript.segments}
          segmentsById={segmentsById}
          onDone={(saved, message) => {
            if (saved) queryClient.setQueryData(notesQuery(lectureId).queryKey, saved);
            setDraft(null);
            setApproveProblems([]);
            setFlash(message ? { kind: "ok", text: message } : null);
          }}
        />
      ) : current ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 pt-4">
            <NotesStatus notes={current} viewerIsTeacher={canEdit} />
            <div className="flex flex-wrap gap-3" data-no-print>
              {canEdit ? (
                <Button
                  className="button"
                  onPress={() => {
                    setFlash(null);
                    setDraft(toDraft(current.sections));
                  }}
                >
                  Edit notes
                </Button>
              ) : null}
              {canEdit && current.status !== "approved" ? (
                <Button
                  className="button"
                  data-variant="primary"
                  isDisabled={approve.isPending}
                  onPress={() => {
                    setFlash(null);
                    approve.mutate();
                  }}
                >
                  {approve.isPending ? "Approving notes" : "Approve notes"}
                </Button>
              ) : null}
              <Button
                className="button"
                isDisabled={download.isPending}
                onPress={() => {
                  download.mutate();
                }}
              >
                Download as Markdown
              </Button>
            </div>
          </div>
          <Messages flash={flash} downloadError={download.error} />
          {!canEdit ? (
            <p className="t-small measure mt-4 text-slate" data-no-print>
              Only the lecture's teacher can edit or approve these notes.
            </p>
          ) : current.status !== "approved" ? (
            <p className="t-small measure mt-4 text-slate" data-no-print>
              Read them through and approve them when they're right. Approving doesn't send them anywhere: download them and share them the way you usually do.
            </p>
          ) : null}
          <NotesReading notes={current} segmentsById={segmentsById} />
        </>
      ) : null}
    </div>
  );
}

function Messages({ flash, downloadError }: { flash: Flash; downloadError: Error | null }) {
  return (
    <div aria-live="polite" className="measure">
      {flash ? (
        <p className={`t-small mt-4 mb-0 border-l-[3px] py-1 pl-3 ${flash.kind === "ok" ? "border-pen" : "border-ochre"}`} role={flash.kind === "problem" ? "alert" : "status"}>
          {flash.text}
        </p>
      ) : null}
      {downloadError ? (
        <p className="t-small mt-4 mb-0 border-l-[3px] border-ochre py-1 pl-3" role="alert">
          The Markdown file couldn't be downloaded. {notesError(downloadError)}
        </p>
      ) : null}
    </div>
  );
}

function notesError(e: Error): string {
  if (isApiError(e, "notes_unavailable")) return "There are no notes for this lecture. Staffroom1 didn't write any, and the teacher hasn't written their own.";
  if (isApiError(e, "analysis_not_ready")) return "The notes will be here when the lecture has finished processing.";
  if (isApiError(e) && e.status === 404) return "This lecture doesn't exist, or it isn't one you can see.";
  if (isApiError(e) && e.status === 403) return "Your role can't open these notes.";
  return "The notes couldn't be loaded. Check your connection, then reload the page.";
}

function approveError(e: Error): string {
  if (isApiError(e, "notes_stale")) return "These notes can't be approved yet: some bullets cite transcript lines that are no longer there. Edit them, choose the lines again and save.";
  return saveError(e);
}

function saveError(e: Error): string {
  if (isApiError(e, "invalid_notes")) return "The notes weren't saved. The places that need a change are marked below.";
  if (isApiError(e, "validation_error")) return "The notes weren't saved. The places that need a change are marked below.";
  if (isApiError(e, "network_error")) return "The notes weren't saved because the connection dropped. Your changes are still here; save again.";
  if (isApiError(e) && e.status === 403) return "Only the lecture's teacher can change these notes.";
  return "The notes weren't saved. Your changes are still here; try again.";
}

function EditMode({
  lectureId,
  initial,
  base,
  initialProblems,
  segments,
  segmentsById,
  onDone,
}: {
  lectureId: string;
  initial: Draft;
  base: NotesOut | null;
  initialProblems: Problem[];
  segments: Parameters<typeof CitationPanel>[0]["segments"];
  segmentsById: ReturnType<typeof segmentIndex>;
  onDone: (saved: NotesOut | null, message: string | null) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [apiProblems, setApiProblems] = useState<Problem[]>(initialProblems);
  const [triedSave, setTriedSave] = useState(initialProblems.length > 0);
  const [active, setActive] = useState<{ section: string; bullet: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the edit ends on purpose (saved or discarded), so leaving isn't blocked.
  const blockerOff = useRef(false);
  const wide = useMediaQuery("(min-width: 64rem)");
  const order = useMemo(() => new Map(segments.map((s, i) => [s.segment_id, i])), [segments]);
  const knownIds = useMemo(() => new Set(order.keys()), [order]);
  const changed = base ? isChanged(draft, base.sections) : true;
  const checks = checkDraft(draft, knownIds);
  // Before the first save, only problems the API reported are shown; after it, the checks too.
  const shown = [...apiProblems, ...(triedSave ? checks : [])];

  const save = useMutation({
    mutationFn: (sent: Draft) => saveNotes(lectureId, toNotesIn(sent)),
    onSuccess: (out) => {
      blockerOff.current = true;
      onDone(out, "Notes saved. They're a draft until you approve them.");
    },
    onError: (e: Error, sent) => {
      setApiProblems(isApiError(e) ? placeApiProblems(e.fields, sent) : []);
      setError(saveError(e));
    },
  });

  const blocker = useBlocker({ shouldBlockFn: () => changed && !blockerOff.current, enableBeforeUnload: () => changed && !blockerOff.current, withResolver: true });

  const activeBullet = active ? findBullet(draft, active.section, active.bullet) : null;
  const activeInfo: ActiveBullet | null =
    active && activeBullet
      ? {
          section: active.section,
          bullet: active.bullet,
          label: `bullet ${(activeBullet.j + 1).toString()} of section ${(activeBullet.i + 1).toString()}`,
          segmentIds: activeBullet.bullet.segmentIds,
        }
      : null;

  const panel = (
    <CitationPanel
      segments={segments}
      active={activeInfo}
      onToggle={(id) => {
        if (!active) return;
        setDraft((d) => toggleCitation(d, active.section, active.bullet, id, order));
        setApiProblems((p) => dropApiProblemsFor(p, { kind: "citations", section: active.section, bullet: active.bullet }));
      }}
      onDone={() => {
        const key = active?.bullet;
        setActive(null);
        if (key) document.querySelector<HTMLElement>(`[data-bullet-key="${key}"] textarea`)?.focus();
      }}
    />
  );

  const places = problemPlaces(shown);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:gap-x-10">
      <div className="min-w-0">
        <div className="measure pt-4">
          <h2 className="t-heading m-0">Editing the notes</h2>
          <p className="t-small mt-2 text-slate">
            Each bullet keeps the transcript lines it's based on (1 to 6). Saving makes the notes a draft again{base?.status === "approved" ? ", so they'll need approving again" : ""}. Nothing is sent to anyone.
          </p>
        </div>
        <div className="sticky top-[var(--player-height)] z-10 -mx-1 mt-4 flex flex-wrap items-center gap-3 bg-sheet px-1 py-3" data-no-print>
          <Button
            className="button"
            data-variant="primary"
            isDisabled={save.isPending}
            onPress={() => {
              setTriedSave(true);
              setError(null);
              if (checks.length > 0) {
                setError("The notes weren't saved yet. The places that need a change are marked below.");
                focusFirstProblem(checks);
                return;
              }
              save.mutate(draft);
            }}
          >
            {save.isPending ? "Saving notes" : "Save notes"}
          </Button>
          <Button
            className="button"
            isDisabled={save.isPending}
            onPress={() => {
              if (changed) setConfirmDiscard(true);
              else {
                blockerOff.current = true;
                onDone(null, null);
              }
            }}
          >
            {changed ? "Discard changes" : "Stop editing"}
          </Button>
          {places > 0 ? (
            <span className="t-small text-ochre">
              {places === 1 ? "1 place needs a change" : `${places.toString()} places need a change`}
            </span>
          ) : null}
        </div>
        <div aria-live="polite">
          {error ? (
            <p className="t-small measure mt-2 border-l-[3px] border-ochre py-1 pl-3" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <ProblemsWithNotes problems={shown.filter((p) => p.target.kind === "notes")} />
        <div className="mt-8">
          <NotesEditor
            draft={draft}
            problems={shown}
            segmentsById={segmentsById}
            activeBullet={active?.bullet ?? null}
            onChange={(next, edited) => {
              setDraft(next);
              if (edited) setApiProblems((p) => dropApiProblemsFor(p, edited));
              if (active && !findBullet(next, active.section, active.bullet)) setActive(null);
            }}
            onChooseLines={(section, bullet) => {
              setActive((cur) => (cur?.bullet === bullet ? null : { section, bullet }));
            }}
          />
        </div>
      </div>
      {wide ? (
        <aside className="sticky top-[var(--player-height)] mt-4 h-[calc(100vh-var(--player-height)-1rem)] min-h-0 border-l border-slate/30 pl-6" aria-label="Transcript for citing" data-no-print>
          {panel}
        </aside>
      ) : (
        <ModalOverlay
          isOpen={active !== null}
          onOpenChange={(open) => {
            if (!open) setActive(null);
          }}
          isDismissable
          className="fixed inset-0 z-40 bg-ink/30"
        >
          <Modal className="fixed inset-y-0 right-0 flex w-full max-w-[34rem] flex-col bg-sheet p-5 shadow-[0_6px_20px_rgb(23_32_30/0.18)]">
            <Dialog aria-label="Choose transcript lines" className="flex h-full min-h-0 flex-col outline-none">
              {panel}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Discard your changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => {
          setConfirmDiscard(false);
        }}
        onConfirm={() => {
          setConfirmDiscard(false);
          blockerOff.current = true;
          onDone(null, null);
        }}
      >
        The notes go back to the last saved version.
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={blocker.status === "blocked"}
        title="Leave without saving?"
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        Your changes to the notes haven't been saved.
      </ConfirmDialog>
    </div>
  );
}

function ProblemsWithNotes({ problems }: { problems: readonly Problem[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className="t-small measure mt-2 list-none space-y-1 p-0 text-ochre" data-problems>
      {[...new Set(problems.map((p) => p.message))].map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

function findBullet(draft: Draft, sectionKey: string, bulletKey: string) {
  const i = draft.findIndex((s) => s.key === sectionKey);
  const s = draft[i];
  if (!s) return null;
  const j = s.bullets.findIndex((b) => b.key === bulletKey);
  const bullet = s.bullets[j];
  return bullet ? { i, j, bullet } : null;
}

function focusFirstProblem(problems: readonly Problem[]) {
  for (const p of problems) {
    const el = document.querySelector<HTMLElement>(`[data-problem-target='${JSON.stringify(p.target)}']`);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "center" });
      return;
    }
  }
}
