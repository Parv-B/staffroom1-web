import type { Schemas } from "~/api/client";

export type LectureStatus = Schemas["LectureStatus"];
export type LectureSummary = Schemas["LectureSummary"];

export const STATUS_LABEL: Readonly<Record<LectureStatus, string>> = {
  awaiting_upload: "Waiting for the recording",
  queued: "Queued",
  running: "Processing",
  done: "Analysed",
  failed: "Processing stopped",
};

export const STATUS_ORDER: readonly LectureStatus[] = ["awaiting_upload", "queued", "running", "done", "failed"];

const CLASS_TYPE: Readonly<Record<string, string>> = { online: "online class", in_person: "in-person class" };

interface Meta {
  board?: unknown;
  grade?: unknown;
  subject?: unknown;
  chapter?: unknown;
  class_type?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** The lecture's name: its chapter, as the teacher entered it. */
export function lectureTitle(metadata: Meta): string {
  return str(metadata.chapter) ?? "Untitled lecture";
}

/** One plain sentence of facts, e.g. "CBSE grade 10 Mathematics, online class, 57 min". */
export function lectureFacts(metadata: Meta, durationMs: number | null | undefined): string {
  const course = [str(metadata.board), str(metadata.grade) ? `grade ${str(metadata.grade) ?? ""}` : null, str(metadata.subject)]
    .filter(Boolean)
    .join(" ");
  const parts = [course || null, CLASS_TYPE[str(metadata.class_type) ?? ""] ?? null, durationMs ? `${Math.round(durationMs / 60_000).toString()} min` : null];
  return parts.filter(Boolean).join(", ");
}
