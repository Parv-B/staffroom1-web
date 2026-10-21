import { ApiError, api, toApiError, unwrap } from "~/api/client";
import type { NotesIn } from "./model";

export function saveNotes(lectureId: string, body: NotesIn) {
  return unwrap(api.PUT("/lectures/{lecture_id}/notes", { params: { path: { lecture_id: lectureId } }, body }));
}

export function approveNotes(lectureId: string) {
  return unwrap(api.POST("/lectures/{lecture_id}/notes/approve", { params: { path: { lecture_id: lectureId } } }));
}

/** The filename the API suggests in Content-Disposition, else a safe default. */
export function filenameFrom(disposition: string | null, lectureId: string): string {
  const m = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
  const name = m?.[1]?.trim();
  return name && /^[\w.-]+$/.test(name) ? name : `${lectureId}-notes.md`;
}

/** Fetches notes.md with the session's token (a plain link can't send it) and saves it. The
 *  API adds the draft and out-of-date lines itself, so the file says what the screen says. */
export async function downloadMarkdown(lectureId: string): Promise<void> {
  let result;
  try {
    result = await api.GET("/lectures/{lecture_id}/notes.md", { params: { path: { lecture_id: lectureId } }, parseAs: "blob" });
  } catch {
    throw new ApiError(0, "network_error", "");
  }
  if (!result.response.ok || !(result.data instanceof Blob)) {
    throw toApiError(result.response.status, result.error);
  }
  const url = URL.createObjectURL(result.data);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFrom(result.response.headers.get("Content-Disposition"), lectureId);
    document.body.append(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
  }
}
