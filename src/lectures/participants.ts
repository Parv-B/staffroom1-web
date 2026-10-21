// The optional participant list and chat log on the new-lecture form. Names are used only to
// remove students' names from the transcript; they stay in memory on this page (never in
// browser storage or logs) and the API never returns them.
import { api, unwrap, type Schemas } from "~/api/client";
import { xhrPut, type PutFn } from "~/upload/transport";

export type ParseOut = Schemas["ParticipantsParseOut"];
export type Participants = Schemas["Participants"];

export interface ParticipantRow {
  readonly key: string;
  readonly name: string;
  readonly role: "teacher" | "student";
}

export interface ParticipantList {
  readonly rows: readonly ParticipantRow[];
  /** The API couldn't tell which row is the teacher (teacher_found: false). */
  readonly teacherUnknown: boolean;
  /** The teacher said they aren't on the list (e.g. an admin's export without the teacher). */
  readonly teacherAbsentConfirmed: boolean;
  readonly warnings: readonly string[];
  readonly summary: string | null;
}

export const EMPTY_LIST: ParticipantList = { rows: [], teacherUnknown: false, teacherAbsentConfirmed: false, warnings: [], summary: null };
export const MAX_STUDENTS = 1000;
export const MAX_NAME = 200;

let n = 0;
const key = () => {
  n += 1;
  return `p${n.toString(36)}`;
};

export function fromParsed(out: ParseOut): ParticipantList {
  const rows: ParticipantRow[] = [];
  if (out.participants.teacher) rows.push({ key: key(), name: out.participants.teacher.display_name, role: "teacher" });
  for (const s of out.participants.students) rows.push({ key: key(), name: s.display_name, role: "student" });
  const bits = [`${out.rows_read.toString()} ${out.rows_read === 1 ? "row" : "rows"} read`];
  if (out.duplicates > 0) bits.push(`${out.duplicates.toString()} repeated ${out.duplicates === 1 ? "name" : "names"} merged`);
  if (out.dropped > 0) bits.push(`${out.dropped.toString()} dropped (phone numbers or meeting bots)`);
  return { rows, teacherUnknown: !out.teacher_found, teacherAbsentConfirmed: false, warnings: out.warnings, summary: `${bits.join(", ")}.` };
}

/** Exactly one teacher: choosing a row makes every other row a student. */
export function setTeacher(list: ParticipantList, rowKey: string): ParticipantList {
  return { ...list, teacherUnknown: false, teacherAbsentConfirmed: false, rows: list.rows.map((r) => ({ ...r, role: r.key === rowKey ? "teacher" : "student" })) };
}

export function addRow(list: ParticipantList): ParticipantList {
  return { ...list, rows: [...list.rows, { key: key(), name: "", role: "student" }] };
}

export function hasTeacher(list: ParticipantList): boolean {
  return list.rows.some((r) => r.role === "teacher" && r.name.trim() !== "");
}

/** Why the list can't be sent yet (null: fine, or no list at all). */
export function listProblem(list: ParticipantList): string | null {
  const named = list.rows.filter((r) => r.name.trim() !== "");
  if (named.length === 0) return null;
  if (named.some((r) => r.name.trim().length > MAX_NAME)) return `A name is longer than ${MAX_NAME.toString()} characters. Shorten it or remove it.`;
  if (named.filter((r) => r.role === "student").length > MAX_STUDENTS) return `The list has more than ${MAX_STUDENTS.toString()} students. Remove the extra rows.`;
  // Never send a list with the teacher among the students unconfirmed: their own name would
  // then be removed from the transcript.
  if (!hasTeacher(list) && !list.teacherAbsentConfirmed) return "Choose the teacher's row in the list, or say the teacher isn't on it.";
  return null;
}

/** The API body, or null when there's no list (an empty list is the same as none). */
export function toParticipants(list: ParticipantList): Participants | null {
  const named = list.rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name !== "");
  if (named.length === 0) return null;
  const teacher = named.find((r) => r.role === "teacher");
  return { teacher: teacher ? { display_name: teacher.name } : null, students: named.filter((r) => r.role === "student").map((r) => ({ display_name: r.name })) };
}

export function parseParticipants(text: string, teacherName: string | null) {
  return unwrap(api.POST("/participants/parse", { body: { text, ...(teacherName ? { teacher_name: teacherName } : {}) } }));
}

// ------------------------------------------------------------------ chat log

export const CHAT_MAX_BYTES = 1024 * 1024;

export function chatContentType(file: { name: string; type: string }): "text/plain" | "text/csv" | null {
  if (file.type === "text/plain" || file.type === "text/csv") return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  return null;
}

export type ChatCheck = { ok: true; contentType: "text/plain" | "text/csv" } | { ok: false; message: string };

export function checkChatFile(file: { name: string; type: string; size: number }): ChatCheck {
  const contentType = chatContentType(file);
  if (!contentType) return { ok: false, message: "Choose the chat as a .txt or .csv file, as Zoom or Meet saves it." };
  if (file.size === 0) return { ok: false, message: "This file is empty. Choose the chat file again." };
  if (file.size > CHAT_MAX_BYTES) return { ok: false, message: "This file is larger than 1 MB, which is more than a class chat. Check it's the chat file." };
  return { ok: true, contentType };
}

/** Uploads a chat file (always a single PUT) and completes it; returns the upload id. */
export async function uploadChat(file: File, contentType: string, signal: AbortSignal, put: PutFn = xhrPut): Promise<string> {
  const init = await unwrap(api.POST("/uploads", { body: { filename: file.name, content_type: contentType, size_bytes: file.size } }));
  if (init.mode !== "single" || !init.url) throw new Error("unexpected upload mode for a chat file");
  await put(init.url, file, init.headers, () => undefined, signal);
  await unwrap(api.POST("/uploads/{upload_id}/complete", { params: { path: { upload_id: init.upload_id } }, body: { parts: [] } }));
  return init.upload_id;
}
