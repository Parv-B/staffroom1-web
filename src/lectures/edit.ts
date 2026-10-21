// Editing a lecture's details after it was submitted (PATCH /lectures/{id}/metadata). Only
// changed fields are sent; the explanation of what reruns mirrors docs/api.md "Editing
// metadata", and the API's own `affected_stages` is shown after saving.
import { api, unwrap, type Schemas } from "~/api/client";
import type { MetadataDraft } from "~/upload/store";
import { EMPTY_DRAFT } from "./MetadataForm";

export type MetadataPatch = Schemas["MetadataPatch"];
export type EditableField = "board" | "grade" | "subject" | "chapter" | "class_type" | "class_composition" | "lesson_plan" | "objectives";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function draftFromMetadata(m: Readonly<Record<string, unknown>>): MetadataDraft {
  const ct = m.class_type;
  const cc = m.class_composition;
  return {
    ...EMPTY_DRAFT,
    board: str(m.board),
    grade: str(m.grade),
    subject: str(m.subject),
    chapter: str(m.chapter),
    class_type: ct === "online" || ct === "in_person" ? ct : "",
    class_composition: cc === "co_ed" || cc === "girls" || cc === "boys" ? cc : "unknown",
    lesson_plan: str(m.lesson_plan),
    objectives: Array.isArray(m.objectives) ? m.objectives.filter((o): o is string => typeof o === "string").join("\n") : "",
  };
}

function objectives(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Only what differs from the stored details (text compared after trimming). */
export function changes(before: MetadataDraft, after: MetadataDraft): { patch: MetadataPatch; fields: EditableField[] } {
  const patch: MetadataPatch = { retranscribe: false };
  const fields: EditableField[] = [];
  for (const k of ["board", "grade", "subject", "chapter"] as const) {
    if (after[k].trim() !== before[k].trim()) {
      patch[k] = after[k].trim();
      fields.push(k);
    }
  }
  if (after.class_type !== before.class_type && after.class_type !== "") {
    patch.class_type = after.class_type;
    fields.push("class_type");
  }
  if (after.class_composition !== before.class_composition) {
    patch.class_composition = after.class_composition;
    fields.push("class_composition");
  }
  if (after.lesson_plan.trim() !== before.lesson_plan.trim()) {
    patch.lesson_plan = after.lesson_plan.trim() || null;
    fields.push("lesson_plan");
  }
  if (JSON.stringify(objectives(after.objectives)) !== JSON.stringify(objectives(before.objectives))) {
    patch.objectives = objectives(after.objectives);
    fields.push("objectives");
  }
  return { patch, fields };
}

/** docs/api.md, "Editing metadata": which parts of the analysis each field feeds. */
const EFFECT: Readonly<Record<EditableField, string>> = {
  board: "the lesson's structure, the coverage of objectives, the findings and the notes",
  grade: "the lesson's structure, the coverage of objectives, the findings and the notes",
  subject: "the lesson's structure, the coverage of objectives, the findings and the notes",
  chapter: "the lesson's structure, the coverage of objectives, the findings and the notes",
  class_type: "who is identified as the teacher, the measures and the findings (and the transcript's speakers, if they change)",
  class_composition: "the findings",
  lesson_plan: "the coverage of objectives",
  objectives: "the coverage of objectives",
};

export const FIELD_LABEL: Readonly<Record<EditableField, string>> = {
  board: "Board",
  grade: "Grade",
  subject: "Subject",
  chapter: "Chapter",
  class_type: "Class type",
  class_composition: "Who was in the class",
  lesson_plan: "Lesson plan",
  objectives: "Learning objectives",
};

/** Plain sentences for each distinct effect, in a stable order. */
export function effects(fields: readonly EditableField[]): string[] {
  return [...new Set(fields.map((f) => EFFECT[f]))];
}

export const STAGE_WORDS: Readonly<Record<string, string>> = {
  ingest: "reading the recording",
  asr: "transcription",
  diarize: "telling speakers apart",
  transcript: "the transcript",
  redact: "removing names",
  questions: "questions",
  structure: "the lesson's structure",
  coverage: "coverage of objectives",
  metrics: "measures",
  findings: "findings",
  notes: "lecture notes",
  report: "the report",
};

export function editMetadata(lectureId: string, patch: MetadataPatch) {
  return unwrap(api.PATCH("/lectures/{lecture_id}/metadata", { params: { path: { lecture_id: lectureId } }, body: patch }));
}
