import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Label, RadioButton, RadioField, RadioGroup, TextArea, TextField } from "react-aria-components";
import type { Schemas } from "~/api/client";
import { feedbackQuery, giveFeedback } from "~/lectures/detail";

type Verdict = Schemas["FeedbackVerdict"];
const VERDICTS: readonly [Verdict, string][] = [
  ["agree", "Agree"],
  ["disagree", "Disagree"],
  ["needs_context", "Needs context"],
];
const VERDICT_LABEL: Readonly<Record<Verdict, string>> = Object.fromEntries(VERDICTS) as Record<Verdict, string>;

/** The lecture's teacher responds to a finding. Private: the owner never sees it. */
export function FindingFeedback({ findingId }: { findingId: string }) {
  const queryClient = useQueryClient();
  const existing = useQuery(feedbackQuery(findingId));
  const mine = existing.data?.[0];
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const current = verdict ?? mine?.verdict ?? null;
  const text = comment ?? mine?.comment ?? "";
  const save = useMutation({
    mutationFn: () => giveFeedback(findingId, current ?? "agree", text.trim() || null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finding", findingId, "feedback"] }),
  });
  const dirty = (verdict !== null && verdict !== mine?.verdict) || (comment !== null && comment !== (mine?.comment ?? ""));
  return (
    <div className="measure mt-5 border-t border-slate/20 pt-4" data-no-print>
      <RadioGroup
        value={current}
        onChange={(v) => { setVerdict(v as Verdict); }}
        orientation="horizontal"
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <Label className="t-small mr-1 font-semibold">Your view</Label>
        {VERDICTS.map(([v, label]) => (
          <RadioField key={v} value={v}>
            <RadioButton className="t-small inline-block cursor-pointer rounded-full border border-slate px-3 py-1 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet">
              {label}
            </RadioButton>
          </RadioField>
        ))}
      </RadioGroup>
      {current ? (
        <div className="mt-3 space-y-2">
          <TextField value={text} onChange={setComment} className="flex flex-col gap-1">
            <Label className="t-small text-slate">{current === "needs_context" ? "What context would change this? (optional)" : "A note (optional)"}</Label>
            <TextArea maxLength={4000} className="t-ui min-h-16 rounded-[3px] border border-slate bg-sheet px-3 py-2" />
          </TextField>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="button" isDisabled={!dirty || save.isPending} onPress={() => { save.mutate(); }}>
              {save.isPending ? "Saving" : "Save response"}
            </Button>
            <span className="t-small text-slate" aria-live="polite">
              {save.isError ? "Not saved. Try again." : mine && !dirty ? "Saved. " : ""}
              Only you and your centre's admins see responses; the owner doesn't.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Admins read the teacher's response, without changing it. */
export function FindingFeedbackReadOnly({ findingId }: { findingId: string }) {
  const q = useQuery(feedbackQuery(findingId));
  if (!q.data) return null;
  return (
    <p className="t-small measure mt-4 text-slate">
      {q.data.length === 0
        ? "The teacher hasn't responded to this finding."
        : q.data.map((f) => `Teacher's response: ${VERDICT_LABEL[f.verdict]}${f.comment ? `. “${f.comment}”` : ""}`).join(" ")}
    </p>
  );
}
