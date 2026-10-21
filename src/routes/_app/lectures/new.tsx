import { useCallback, useEffect, useEffectEvent, useRef, useState, type SyntheticEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, DropZone, type FileDropItem, FileTrigger, Form, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text } from "react-aria-components";
import { api, isApiError, unwrap, type Schemas } from "~/api/client";
import { can } from "~/auth/roles";
import { EMPTY_DRAFT, MetadataForm, fieldFor, type DraftField } from "~/lectures/MetadataForm";
import { ChatLogPanel, ParticipantsPanel, type ChatState } from "~/lectures/ParticipantsPanel";
import { EMPTY_LIST, listProblem, toParticipants, type ParticipantList } from "~/lectures/participants";
import { EMPTY_ASSIST, applySuggestion, fetchSuggestion, keepField, noteEdits, objectivesToSubmit, type FormAssist } from "~/lectures/suggest";
import type { MetadataDraft, UploadRecord } from "~/upload/store";
import { missingParts } from "~/upload/uploader";
import { useUpload, type UploadState } from "~/upload/useUpload";

export const Route = createFileRoute("/_app/lectures/new")({
  component: NewLecture,
});

const usersQuery = { queryKey: ["users"], queryFn: () => unwrap(api.GET("/users")) } as const;

function bytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(n >= 100 * 1024 ** 2 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(n / 1024)).toString()} KB`;
}

function NewLecture() {
  const { me } = Route.useRouteContext();
  if (!can.upload(me.role)) {
    return (
      <main className="measure pt-6">
        <h1 className="t-heading">Upload a lecture</h1>
        <p className="t-reading mt-3">Teachers and admins upload recordings. As the centre owner you can see every lecture in the list.</p>
        <p className="t-reading mt-3">
          <Link to="/lectures" className="action">
            Go to the lectures
          </Link>
        </p>
      </main>
    );
  }
  return <Uploader userId={me.user_id} isAdmin={me.role === "admin"} />;
}

interface FormState {
  draft: MetadataDraft;
  assist: FormAssist;
}

function Uploader({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [form, setForm] = useState<FormState>({ draft: EMPTY_DRAFT, assist: EMPTY_ASSIST });
  const { draft, assist } = form;
  // The latest form, for applying a suggestion that arrives while the teacher is typing.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  // The teacher's own edits: recorded as touched, so a suggestion never overwrites them.
  const editDraft = useCallback((next: MetadataDraft) => {
    setForm((f) => ({ draft: next, assist: noteEdits(f.draft, next, f.assist) }));
  }, []);
  // A resumed or reopened upload brings back the details (and their suggestion marks).
  const restore = useCallback((rec: UploadRecord) => {
    if (rec.draft) setForm({ draft: rec.draft, assist: rec.assist ?? EMPTY_ASSIST });
  }, []);
  const up = useUpload(userId, restore);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Kept in memory only: names of minors never go to browser storage.
  const [participants, setParticipants] = useState<ParticipantList>(EMPTY_LIST);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatState>({ kind: "none" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teachers = useQuery({ ...usersQuery, enabled: isAdmin, select: (u: Schemas["UserOut"][]) => u.filter((x) => x.role === "teacher" && x.active) });

  const record = up.state.kind === "completed" ? up.state.record : up.state.kind === "idle" ? null : up.state.record;

  // Keep a draft of the details with the saved upload, so a refresh doesn't lose them.
  const draftTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!record) return;
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => void up.saveDraft(record, draft, assist), 500);
    return () => {
      window.clearTimeout(draftTimer.current);
    };
  }, [draft, assist, record, up]);

  // Ask for suggestions once per finished upload. Never blocks the form or the submit button.
  const completedId = up.state.kind === "completed" ? up.state.record.uploadId : null;
  const [suggest, setSuggest] = useState<SuggestStatus>({ kind: "idle" });
  const askedFor = useRef<string | null>(null);
  const teacherForHistory = isAdmin ? draft.teacher_user_id || null : null;
  const runSuggest = useCallback(
    async (uploadId: string, refresh: boolean, signal?: AbortSignal) => {
      setSuggest({ kind: "running" });
      const out = await fetchSuggestion(uploadId, { refresh, teacherUserId: teacherForHistory, ...(signal ? { signal } : {}) });
      if (signal?.aborted) return;
      if (out.kind === "off") {
        setSuggest({ kind: "off" });
      } else if (out.kind === "failed" || out.suggestion.reason_if_unavailable) {
        setSuggest({ kind: "none" });
      } else {
        const r = applySuggestion(formRef.current.draft, formRef.current.assist, out.suggestion);
        setForm({ draft: r.draft, assist: r.assist });
        setSuggest({ kind: "done", filled: r.filled });
      }
    },
    [teacherForHistory],
  );
  // Only a newly finished upload starts a request; choosing a teacher later doesn't.
  const startSuggest = useEffectEvent((uploadId: string, signal: AbortSignal) => {
    void runSuggest(uploadId, false, signal);
  });
  useEffect(() => {
    if (!completedId || askedFor.current === completedId) return;
    askedFor.current = completedId;
    const ac = new AbortController();
    startSuggest(completedId, ac.signal);
    return () => {
      ac.abort();
      askedFor.current = null;
    };
  }, [completedId]);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (up.state.kind !== "completed") {
      setFormError("The recording hasn't finished uploading. The lecture can be created once it has.");
      return;
    }
    const missing: Partial<Record<DraftField, string>> = {};
    if (!draft.board.trim()) missing.board = "Enter the board.";
    if (!draft.grade) missing.grade = "Choose the grade.";
    if (!draft.subject.trim()) missing.subject = "Enter the subject.";
    if (!draft.chapter.trim()) missing.chapter = "Enter the chapter.";
    if (!draft.class_type) missing.class_type = "Choose online or in person.";
    if (isAdmin && !draft.teacher_user_id) missing.teacher_user_id = "Choose whose lecture this is.";
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    const listIssue = listProblem(participants);
    if (listIssue) {
      setFormError(`The participant list needs a change: ${listIssue}`);
      return;
    }
    if (chat.kind === "uploading") {
      setFormError("The chat file is still uploading. Create the lecture when it has finished.");
      return;
    }
    setParticipantsError(null);

    const rec = up.state.record;
    setSubmitting(true);
    try {
      const created = await unwrap(
        api.POST("/lectures", {
          body: {
            upload_id: rec.uploadId,
            teacher_user_id: isAdmin ? draft.teacher_user_id : null,
            metadata: {
              board: draft.board.trim(),
              grade: draft.grade,
              subject: draft.subject.trim(),
              chapter: draft.chapter.trim(),
              class_type: draft.class_type === "in_person" ? "in_person" : "online",
              class_composition: draft.class_composition,
              teacher_id: null,
              lesson_plan: draft.lesson_plan.trim() || null,
              objectives: objectivesToSubmit(draft, assist),
            },
            participants: toParticipants(participants),
            chat_upload_id: chat.kind === "ready" ? chat.uploadId : null,
          },
        }),
      );
      await up.forget(rec);
      await queryClient.invalidateQueries({ queryKey: ["lectures"] });
      await navigate({ to: "/lectures/$lectureId", params: { lectureId: created.lecture_id } });
    } catch (err) {
      setSubmitting(false);
      if (isApiError(err, "validation_error")) {
        const byField: Partial<Record<DraftField, string>> = {};
        for (const f of err.fields) {
          const k = fieldFor(f);
          if (k) byField[k] = "Check this field.";
        }
        setErrors(byField);
        setFormError("Some details weren't accepted. They're marked above.");
      } else if (isApiError(err, "invalid_participants")) {
        setParticipantsError("The participant list wasn't accepted: a name is empty or too long, or there are more than 1000 students. Check the list.");
        setFormError("The lecture wasn't created. The participant list needs a change.");
      } else if (isApiError(err, "wrong_upload_kind") || (isApiError(err, "upload_used") && chat.kind === "ready" && /chat/i.test(err.message))) {
        setChat({ kind: "error", message: "This chat file can't be used for this lecture. Choose the chat file again." });
        setFormError("The lecture wasn't created. Choose the chat file again, or leave it out.");
      } else if (isApiError(err, "upload_used")) {
        await up.forget(rec);
        setFormError("This recording already belongs to a lecture. Check the lecture list before uploading it again.");
      } else if (isApiError(err, "teacher_required")) {
        setErrors({ teacher_user_id: "Choose an active teacher in this centre." });
      } else if (isApiError(err, "upload_not_completed")) {
        setFormError("The recording isn't complete in storage yet. Upload it again.");
      } else {
        setFormError("The lecture wasn't created because Staffroom1 couldn't be reached. Your details are kept; try again.");
      }
    }
  }

  return (
    <main className="pt-6">
      <p className="t-small">
        <Link to="/lectures" className="action">
          All lectures
        </Link>
      </p>
      <h1 className="t-heading mt-3">Upload a lecture</h1>
      <p className="t-reading measure mt-2 text-slate">
        The recording goes straight to secure storage. Processing starts when you create the lecture, and takes a few minutes for an
        hour of class.
      </p>

      <div className="mt-8 grid gap-10 bg-sheet px-5 py-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="recording-heading">
          <h2 id="recording-heading" className="t-subheading">
            The recording
          </h2>
          <RecordingPanel
            state={up.state}
            saved={up.saved}
            onFile={(f) => void up.start(f)}
            onPause={up.pause}
            onContinue={(f, rec) => void up.start(f, rec)}
            onCancel={(rec) => void up.cancel(rec)}
            onReopen={(rec) => {
              up.reopen(rec);
              restore(rec);
            }}
            onDiscardSaved={(rec) => void up.cancel(rec)}
          />
        </section>

        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="t-subheading">
            About the lesson
          </h2>
          <p className="t-small mt-1 text-slate">
            {up.state.kind === "completed" ? "Board, grade, subject, chapter and class type are needed." : "You can fill this in while the recording uploads."}
          </p>
          <SuggestLine
            status={suggest}
            onAgain={completedId ? () => void runSuggest(completedId, true) : null}
          />
          <div className="mb-6" />
          <Form onSubmit={(e) => void onSubmit(e)} validationBehavior="aria">
            <MetadataForm
              draft={draft}
              onChange={editDraft}
              errors={errors}
              assist={assist}
              onKeep={(field) => {
                setForm((f) => ({ ...f, assist: keepField(f.assist, field) }));
              }}
              onKeepObjective={(i) => {
                setForm((f) => ({ ...f, assist: { ...f.assist, objectives: f.assist.objectives.map((o, j) => (j === i ? { ...o, kept: true } : o)) } }));
              }}
              onRemoveObjective={(i) => {
                setForm((f) => ({ ...f, assist: { ...f.assist, objectives: f.assist.objectives.filter((_, j) => j !== i) } }));
              }}
              teacherPicker={
                isAdmin ? (
                  <TeacherPicker
                    teachers={teachers.data ?? []}
                    loading={teachers.isPending}
                    value={draft.teacher_user_id}
                    error={errors.teacher_user_id}
                    onChange={(v) => {
                      editDraft({ ...draft, teacher_user_id: v });
                    }}
                  />
                ) : null
              }
            />
            <fieldset className="mt-10 space-y-8 border-0 border-t border-slate/30 p-0 pt-6">
              <legend className="t-subheading float-left mb-1 w-full p-0">Participant list and chat (optional)</legend>
              <p className="t-small measure clear-both m-0 text-slate">
                Both help Staffroom1 remove students' names from the transcript. Without them, names are found from a general list of names, which can miss some.
              </p>
              <ParticipantsPanel
                list={participants}
                onChange={(l) => {
                  setParticipants(l);
                  setParticipantsError(null);
                }}
                teacherName={isAdmin ? ((teachers.data ?? []).find((t) => t.id === draft.teacher_user_id)?.display_name ?? null) : null}
                isAdmin={isAdmin}
                serverError={participantsError}
              />
              <ChatLogPanel chat={chat} onChange={setChat} />
            </fieldset>
            <div className="mt-8 space-y-3" aria-live="polite">
              {formError ? (
                <p className="t-small border-l-[3px] border-ink pl-3" role="alert">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" className="button" data-variant="primary" isDisabled={submitting}>
                {submitting ? "Creating the lecture" : "Create lecture"}
              </Button>
              {up.state.kind !== "completed" ? <p className="t-small text-slate">Available once the recording has uploaded.</p> : null}
            </div>
          </Form>
        </section>
      </div>
    </main>
  );
}

type SuggestStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; filled: number }
  | { kind: "none" }
  | { kind: "off" };

/** A quiet line about suggestions. The form never waits for it. */
function SuggestLine({ status, onAgain }: { status: SuggestStatus; onAgain: (() => void) | null }) {
  if (status.kind === "idle" || status.kind === "off") return null;
  const filled = status.kind === "done" ? status.filled : 0;
  return (
    <div className="t-small mt-2 text-slate" aria-live="polite" data-suggest-status={status.kind}>
      <p className="m-0">
        {status.kind === "running"
          ? "Suggesting details from the recording. Keep going; anything you fill in is left alone."
          : status.kind === "none"
            ? "No suggestions for this recording."
            : filled > 0
              ? `Suggested ${filled === 1 ? "1 detail" : `${filled.toString()} details`} from the recording, marked below. Check each one before you create the lecture.`
              : "Nothing to suggest that you hadn't already filled in."}
        {status.kind === "done" && onAgain ? (
          <>
            {" "}
            <Button className="action" onPress={onAgain}>
              Suggest again
            </Button>
          </>
        ) : null}
      </p>
      <details className="mt-1">
        <summary className="action w-fit">Where suggestions come from</summary>
        <p className="measure mt-1">
          Up to 5 minutes from the start of the class are sent to the transcription service. The transcript of that excerpt, with
          students' names removed, goes to the AI model with the file name and your earlier lectures' details. The excerpt isn't
          kept; only the suggestions are. Names not on the centre's name list may not be removed.
        </p>
      </details>
    </div>
  );
}

function TeacherPicker({
  teachers,
  loading,
  value,
  error,
  onChange,
}: {
  teachers: Schemas["UserOut"][];
  loading: boolean;
  value: string;
  error: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      value={value || null}
      onChange={(k) => {
        if (k !== null) onChange(String(k));
      }}
      isRequired
      isInvalid={Boolean(error)}
      placeholder={loading ? "Loading teachers" : "Choose a teacher"}
      className="flex flex-col gap-1.5"
    >
      <Label className="t-small font-semibold">Teacher</Label>
      <Button className="t-ui flex w-full items-center justify-between gap-3 rounded-[3px] border border-slate bg-sheet px-3 py-2 text-left data-[invalid]:border-2 data-[invalid]:border-ink">
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      <Text slot="description" className="t-small text-slate">
        You're uploading on this teacher's behalf. The lecture and its analysis will be theirs.
      </Text>
      {error ? <Text slot="errorMessage" className="t-small">{error}</Text> : null}
      <Popover className="min-w-[--trigger-width] border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
        <ListBox className="t-ui max-h-80 overflow-auto outline-none" renderEmptyState={() => <p className="t-small px-3 py-2">There are no active teachers in this centre.</p>}>
          {teachers.map((t) => (
            <ListBoxItem key={t.id} id={t.id} textValue={t.display_name ?? t.email} className="cursor-pointer px-3 py-1.5 outline-none data-[focused]:bg-pen-tint data-[selected]:font-semibold">
              {t.display_name ?? t.email}
              {t.display_name ? <span className="t-small text-slate"> {t.email}</span> : null}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

interface PanelProps {
  state: UploadState;
  saved: UploadRecord[];
  onFile: (f: File) => void;
  onPause: () => void;
  onContinue: (f: File, rec: UploadRecord) => void;
  onCancel: (rec: UploadRecord | null) => void;
  onReopen: (rec: UploadRecord) => void;
  onDiscardSaved: (rec: UploadRecord) => void;
}

const ACCEPT = ["audio/*", "video/*"];

function RecordingPanel(p: PanelProps) {
  const s = p.state;
  if (s.kind === "idle") {
    return (
      <div className="mt-4 space-y-6">
        <SavedUploads saved={p.saved} onReopen={p.onReopen} onDiscard={p.onDiscardSaved} />
        <DropZone
          onDrop={(e) => {
            const item = e.items.find((i): i is FileDropItem => i.kind === "file");
            if (item) void item.getFile().then(p.onFile);
          }}
          className="flex flex-col items-start gap-3 border border-dashed border-slate px-5 py-8 data-[drop-target]:border-pen data-[drop-target]:bg-pen-tint"
        >
          <FileTrigger acceptedFileTypes={ACCEPT} onSelect={(files) => { const f = files?.[0]; if (f) p.onFile(f); }}>
            <Button className="button" data-variant="primary">
              Choose the recording
            </Button>
          </FileTrigger>
          <Text slot="label" className="t-small text-slate">
            Or drop it here. An audio or video file of the whole class, up to 5 GB.
          </Text>
        </DropZone>
      </div>
    );
  }
  if (s.kind === "completed") {
    return (
      <div className="mt-4 space-y-3">
        <ProgressBar fraction={1} label={`${s.record.file.name} uploaded`} />
        <p className="t-reading m-0">
          <span className="font-semibold">{s.record.file.name}</span> is uploaded ({bytes(s.record.file.size)}).
        </p>
        <p className="t-small text-slate">Add the details and create the lecture to start processing.</p>
        <Button className="action t-small" onPress={() => { p.onCancel(s.record); }}>
          Remove this recording and choose another
        </Button>
      </div>
    );
  }
  const file = s.file;
  const progress = s.kind === "failed" ? null : s.progress;
  const fraction = progress ? progress.sentBytes / progress.totalBytes : 0;
  const record = s.record;
  return (
    <div className="mt-4 space-y-3">
      <p className="t-reading m-0">
        <span className="font-semibold">{file?.name}</span> {file ? `(${bytes(file.size)})` : null}
      </p>
      {s.kind === "uploading" && s.resumed ? <p className="t-small m-0 text-slate">Continuing the earlier upload of this file.</p> : null}
      <ProgressBar fraction={fraction} label="Upload progress" />
      {progress ? (
        <p className="t-small nums m-0 text-slate" aria-live="off">
          {bytes(progress.sentBytes)} of {bytes(progress.totalBytes)} sent
          {progress.partCount > 1 ? `, ${progress.partsDone.toString()} of ${progress.partCount.toString()} parts stored` : ""}
          {progress.retrying && s.kind === "uploading" ? ". The connection dropped; trying again." : "."}
        </p>
      ) : null}
      {s.kind === "paused" ? <p className="t-small m-0">Paused. Finished parts are kept.</p> : null}
      {s.kind === "failed" ? (
        <p className="t-small m-0 border-l-[3px] border-ink pl-3" role="alert">
          {s.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        {s.kind === "uploading" && record?.mode === "multipart" ? (
          <Button className="button" onPress={p.onPause}>
            Pause
          </Button>
        ) : null}
        {(s.kind === "paused" || (s.kind === "failed" && s.canContinue)) && file && record ? (
          <Button className="button" data-variant="primary" onPress={() => { p.onContinue(file, record); }}>
            Continue uploading
          </Button>
        ) : null}
        <Button className="button" onPress={() => { p.onCancel(record); }}>
          {s.kind === "failed" && !s.canContinue ? "Choose another file" : "Cancel upload"}
        </Button>
      </div>
    </div>
  );
}

function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.floor(fraction * 100)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 w-full bg-desk">
      <div className="h-full bg-pen" style={{ width: `${pct.toString()}%` }} />
    </div>
  );
}

function SavedUploads({
  saved,
  onReopen,
  onDiscard,
}: {
  saved: UploadRecord[];
  onReopen: (r: UploadRecord) => void;
  onDiscard: (r: UploadRecord) => void;
}) {
  if (saved.length === 0) return null;
  return (
    <div>
      <h3 className="t-small m-0 font-semibold">Unfinished uploads on this device</h3>
      <ul className="mt-2 list-none space-y-3 p-0">
        {saved.map((r) => {
          const done = r.state === "completed";
          const stored = r.partCount ? r.partCount - missingParts(r).length : 0;
          return (
            <li key={r.key} className="border-l-[3px] border-slate/40 pl-3">
              <p className="t-small m-0">
                <span className="font-semibold">{r.file.name}</span> ({bytes(r.file.size)}).{" "}
                {done
                  ? "Uploaded, but no lecture was created for it yet."
                  : `${stored.toString()} of ${(r.partCount ?? 0).toString()} parts stored. Choose the same file below to continue where it stopped.`}
                {r.draft ? " The lesson details you typed are kept." : null}
              </p>
              <p className="t-small mt-1 flex gap-4">
                {done ? (
                  <Button className="action" onPress={() => { onReopen(r); }}>
                    Add the details
                  </Button>
                ) : null}
                <Button className="action" onPress={() => { onDiscard(r); }}>
                  Discard
                </Button>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
