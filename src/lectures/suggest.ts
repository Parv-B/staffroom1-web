// AI-suggested lecture details (POST /uploads/{id}/suggest-metadata). Suggestions only fill
// fields the teacher hasn't touched, every filled field stays marked until the teacher keeps or
// edits it, and nothing here ever submits the form.
import { api, isApiError, unwrap, type Schemas } from "~/api/client";
import type { MetadataDraft } from "~/upload/store";

export type Suggestion = Schemas["MetadataSuggestionOut"];
export type SuggestableField = "board" | "grade" | "subject" | "chapter" | "class_type" | "class_composition";
export const SUGGESTABLE: readonly SuggestableField[] = ["board", "grade", "subject", "chapter", "class_type", "class_composition"];

/** Below this the backend's guess is usually from the teacher's history, not the recording. */
export const LOW_CONFIDENCE = 0.6;

export interface Mark {
  reason: string | null;
  tentative: boolean;
}

export interface SuggestedObjective {
  text: string;
  kept: boolean;
}

/** What the form knows about suggestions, saved with the upload's draft. */
export interface FormAssist {
  /** Fields the teacher has changed: never prefilled again. */
  touched: (keyof MetadataDraft)[];
  /** Prefilled fields not yet kept or edited. */
  marks: Partial<Record<SuggestableField, Mark>>;
  /** Objectives the teacher stated in the recording; submitted unless removed. */
  objectives: SuggestedObjective[];
}

export const EMPTY_ASSIST: FormAssist = { touched: [], marks: {}, objectives: [] };

const VALID: Partial<Record<SuggestableField, readonly string[]>> = {
  grade: ["9", "10", "11", "12"],
  class_type: ["online", "in_person"],
  // "unknown" is the form's default, so it is never a suggestion worth marking.
  class_composition: ["co_ed", "girls", "boys"],
};

function isEmpty(field: SuggestableField, draft: MetadataDraft): boolean {
  return field === "class_composition" ? draft.class_composition === "unknown" : draft[field].trim() === "";
}

/** Prefills the untouched, empty fields (or ones still showing an earlier suggestion) and adds
 *  the stated objectives. Returns how many things were filled in. */
export function applySuggestion(draft: MetadataDraft, assist: FormAssist, s: Suggestion): { draft: MetadataDraft; assist: FormAssist; filled: number } {
  if (s.reason_if_unavailable) return { draft, assist, filled: 0 };
  const next: MetadataDraft = { ...draft };
  const marks = { ...assist.marks };
  let filled = 0;
  for (const field of SUGGESTABLE) {
    const f = s.fields?.[field];
    const value = f?.value?.trim();
    if (!f || !value) continue;
    if (assist.touched.includes(field)) continue;
    if (!isEmpty(field, draft) && !marks[field]) continue;
    const allowed = VALID[field];
    if (allowed && !allowed.includes(value)) continue;
    (next as Record<SuggestableField, string>)[field] = value;
    marks[field] = { reason: f.reason ?? null, tentative: f.confidence < LOW_CONFIDENCE };
    filled++;
  }
  const have = new Set([...draft.objectives.split("\n"), ...assist.objectives.map((o) => o.text)].map((t) => t.trim().toLowerCase()).filter(Boolean));
  const objectives = [...assist.objectives];
  if (!assist.touched.includes("objectives")) {
    for (const text of s.objectives) {
      const t = text.trim();
      if (!t || have.has(t.toLowerCase())) continue;
      have.add(t.toLowerCase());
      objectives.push({ text: t, kept: false });
      filled++;
    }
  }
  return { draft: next, assist: { ...assist, marks, objectives }, filled };
}

/** Records which fields the teacher changed; a changed field loses its suggestion mark. */
export function noteEdits(before: MetadataDraft, after: MetadataDraft, assist: FormAssist): FormAssist {
  const changed = (Object.keys(after) as (keyof MetadataDraft)[]).filter((k) => after[k] !== before[k]);
  if (changed.length === 0) return assist;
  return { ...assist, marks: withoutMarks(assist.marks, changed), touched: [...new Set([...assist.touched, ...changed])] };
}

export function keepField(assist: FormAssist, field: SuggestableField): FormAssist {
  return { ...assist, marks: withoutMarks(assist.marks, [field]), touched: [...new Set([...assist.touched, field])] };
}

function withoutMarks(marks: FormAssist["marks"], fields: readonly string[]): FormAssist["marks"] {
  return Object.fromEntries(Object.entries(marks).filter(([k]) => !fields.includes(k)));
}

/** The objectives sent with the lecture: the teacher's lines, then the suggestions not removed. */
export function objectivesToSubmit(draft: MetadataDraft, assist: FormAssist): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...draft.objectives.split("\n"), ...assist.objectives.map((o) => o.text)]) {
    const s = t.trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

export type SuggestOutcome =
  | { kind: "result"; suggestion: Suggestion }
  | { kind: "off" } // 404 not_enabled: the feature is switched off; say nothing
  | { kind: "failed" }; // timeout, network, anything else: the form simply works without it

const RETRY_MS = 5_000;
const DEADLINE_MS = 120_000;

/** Calls the endpoint, waiting out `409 suggestion_in_progress` (a run already going). */
export async function fetchSuggestion(
  uploadId: string,
  opts: { refresh?: boolean; teacherUserId?: string | null; signal?: AbortSignal; sleep?: (ms: number) => Promise<void> },
): Promise<SuggestOutcome> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = Date.now() + DEADLINE_MS;
  let refresh = opts.refresh ?? false;
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(DEADLINE_MS)]) : AbortSignal.timeout(DEADLINE_MS);
  for (;;) {
    try {
      const suggestion = await unwrap(
        api.POST("/uploads/{upload_id}/suggest-metadata", {
          params: { path: { upload_id: uploadId }, query: { refresh, ...(opts.teacherUserId ? { teacher_user_id: opts.teacherUserId } : {}) } },
          signal,
        }),
      );
      return { kind: "result", suggestion };
    } catch (e) {
      if (isApiError(e, "not_enabled")) return { kind: "off" };
      if (isApiError(e, "suggestion_in_progress") && Date.now() + RETRY_MS < deadline && !signal.aborted) {
        refresh = false; // the run in progress will store its result; just collect it
        await sleep(RETRY_MS);
        continue;
      }
      return { kind: "failed" };
    }
  }
}
