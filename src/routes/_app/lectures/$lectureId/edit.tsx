import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Form } from "react-aria-components";
import { isApiError } from "~/api/client";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { FIELD_LABEL, STAGE_WORDS, changes, draftFromMetadata, editMetadata, effects } from "~/lectures/edit";
import { lectureDetailQuery, isInProgress } from "~/lectures/detail";
import { MetadataForm, fieldFor, type DraftField } from "~/lectures/MetadataForm";
import { EMPTY_ASSIST } from "~/lectures/suggest";
import type { MetadataDraft } from "~/upload/store";

export const Route = createFileRoute("/_app/lectures/$lectureId/edit")({
  component: EditDetails,
});

function EditDetails() {
  const { lectureId } = Route.useParams();
  const { me } = Route.useRouteContext();
  const detail = useQuery(lectureDetailQuery(lectureId));
  const d = detail.data;
  if (!d) return null; // the lecture layout shows loading and errors
  const canEdit = me.role === "admin" || (me.role === "teacher" && d.teacher_user_id === me.user_id);
  if (!canEdit) {
    return <p className="t-reading measure py-8">Only the lecture's teacher and the centre's admins can change its details.</p>;
  }
  if (isInProgress(d.status)) {
    return (
      <p className="t-reading measure py-8">
        The lecture is being processed. Its details can be changed when that has finished.{" "}
        <Link to="/lectures/$lectureId/status" params={{ lectureId }} className="action">
          See the processing status
        </Link>
      </p>
    );
  }
  return <Editor lectureId={lectureId} initial={draftFromMetadata(d.metadata)} />;
}

function Editor({ lectureId, initial }: { lectureId: string; initial: MetadataDraft }) {
  const [draft, setDraft] = useState<MetadataDraft>(initial);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "problem"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { patch, fields } = changes(initial, draft);

  const save = useMutation({
    mutationFn: () => editMetadata(lectureId, patch),
    onSuccess: async (out) => {
      await queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
      void queryClient.invalidateQueries({ queryKey: ["lectures"] });
      if (!out.job_queued) {
        setMessage({ kind: "ok", text: "Nothing changed, so nothing is processed again." });
        return;
      }
      const stages = out.affected_stages.map((s) => STAGE_WORDS[s] ?? s).join(", ");
      void navigate({ to: "/lectures/$lectureId/status", params: { lectureId }, search: { edited: stages } });
    },
    onError: (e) => {
      if (isApiError(e, "validation_error")) {
        const byField: Partial<Record<DraftField, string>> = {};
        for (const f of e.fields) {
          const k = fieldFor(f);
          if (k) byField[k] = "Check this field.";
        }
        setErrors(byField);
        setMessage({ kind: "problem", text: "Nothing was saved. Some details weren't accepted; they're marked above." });
      } else if (isApiError(e, "already_queued")) {
        setMessage({ kind: "problem", text: "The lecture is already being processed, so nothing was saved. Try again when processing has finished." });
      } else if (isApiError(e, "media_deleted") || isApiError(e, "no_media")) {
        setMessage({ kind: "problem", text: "This change needs the recording, which is no longer stored. Nothing was saved. Other details can still be changed." });
      } else if (isApiError(e) && (e.status === 403 || e.status === 404)) {
        setMessage({ kind: "problem", text: "You can't change this lecture's details." });
      } else {
        setMessage({ kind: "problem", text: "Nothing was saved because Staffroom1 couldn't be reached. Your changes are still here; try again." });
      }
    },
  });

  const missing = (): Partial<Record<DraftField, string>> => {
    const m: Partial<Record<DraftField, string>> = {};
    if (!draft.board.trim()) m.board = "Enter the board.";
    if (!draft.grade) m.grade = "Choose the grade.";
    if (!draft.subject.trim()) m.subject = "Enter the subject.";
    if (!draft.chapter.trim()) m.chapter = "Enter the chapter.";
    if (!draft.class_type) m.class_type = "Choose online or in person.";
    return m;
  };

  return (
    <div className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <div className="min-w-0">
        <h2 className="t-heading m-0">Edit the lecture's details</h2>
        <p className="t-small measure mt-2 mb-8 text-slate">
          Correct anything that was wrong when the lecture was submitted. Only the parts of the analysis that depend on what you change are worked out again.
        </p>
        <Form
          validationBehavior="aria"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            const m = missing();
            setErrors(m);
            if (Object.keys(m).length > 0) return;
            if (fields.length === 0) {
              setMessage({ kind: "ok", text: "Nothing has changed yet." });
              return;
            }
            setConfirming(true);
          }}
        >
          <MetadataForm
            draft={draft}
            onChange={(next) => {
              setDraft(next);
              setMessage(null);
            }}
            errors={errors}
            teacherPicker={null}
            assist={EMPTY_ASSIST}
            onKeep={() => undefined}
            onKeepObjective={() => undefined}
            onRemoveObjective={() => undefined}
          />
          <div className="mt-8 space-y-3" aria-live="polite">
            {message ? (
              <p className={`t-small measure m-0 border-l-[3px] py-1 pl-3 ${message.kind === "ok" ? "border-pen" : "border-ochre"}`} role={message.kind === "ok" ? "status" : "alert"}>
                {message.text}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="button" data-variant="primary" isDisabled={save.isPending}>
                {save.isPending ? "Saving details" : "Save details"}
              </Button>
              <Link to="/lectures/$lectureId" params={{ lectureId }} className="button no-underline">
                Cancel
              </Link>
            </div>
          </div>
        </Form>
      </div>
      <aside aria-labelledby="effects-h" className="lg:sticky lg:top-4 lg:self-start">
        <h3 id="effects-h" className="t-ui m-0 font-semibold">
          What saving will do
        </h3>
        <Effects fields={fields} />
      </aside>
      <ConfirmDialog
        isOpen={confirming}
        title="Save the details and process the lecture again?"
        confirmLabel="Save and process again"
        cancelLabel="Go back"
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          save.mutate();
        }}
      >
        <Effects fields={fields} />
      </ConfirmDialog>
    </div>
  );
}

function Effects({ fields }: { fields: ReturnType<typeof changes>["fields"] }) {
  if (fields.length === 0) return <p className="t-small mt-2 text-slate">Nothing has changed yet. Change a detail to see what would be worked out again.</p>;
  return (
    <div className="t-small mt-2 space-y-2" data-edit-effects>
      <p className="m-0">Changed: {fields.map((f) => FIELD_LABEL[f].toLowerCase()).join(", ")}.</p>
      <p className="m-0">These parts of the analysis are worked out again: {effects(fields).join("; ")}.</p>
      <p className="m-0">
        It takes a few minutes, and the lecture shows as processing until it's done. Findings may change. The transcript isn't redone, and the teacher's edited lecture
        notes are kept.
      </p>
    </div>
  );
}
