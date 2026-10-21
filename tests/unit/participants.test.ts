import { describe, expect, it } from "vitest";
import { EMPTY_LIST, checkChatFile, fromParsed, listProblem, setTeacher, toParticipants, type ParseOut } from "~/lectures/participants";

const parsed = (over: Partial<ParseOut> = {}): ParseOut => ({
  participants: { teacher: null, students: [{ display_name: "Asha" }, { display_name: "Kabir" }] },
  teacher_found: false,
  source_format: "lines",
  rows_read: 3,
  dropped: 1,
  duplicates: 0,
  warnings: ["The teacher couldn't be identified."],
  ...over,
});

describe("participant list", () => {
  it("never sends a list whose teacher is unconfirmed (their name would be removed)", () => {
    const l = fromParsed(parsed());
    expect(l.teacherUnknown).toBe(true);
    expect(listProblem(l)).toMatch(/Choose the teacher's row/);
    expect(listProblem({ ...l, teacherAbsentConfirmed: true })).toBeNull();
    const chosen = setTeacher(l, l.rows[0]?.key ?? "");
    expect(listProblem(chosen)).toBeNull();
    expect(toParticipants(chosen)).toEqual({ teacher: { display_name: "Asha" }, students: [{ display_name: "Kabir" }] });
  });

  it("keeps exactly one teacher", () => {
    const l = fromParsed(parsed({ participants: { teacher: { display_name: "T" }, students: [{ display_name: "S" }] }, teacher_found: true }));
    const swapped = setTeacher(l, l.rows[1]?.key ?? "");
    expect(swapped.rows.map((r) => r.role)).toEqual(["student", "teacher"]);
  });

  it("drops blank rows and treats an empty list as none", () => {
    expect(toParticipants(EMPTY_LIST)).toBeNull();
    const l = { ...fromParsed(parsed({ participants: { teacher: { display_name: "T" }, students: [{ display_name: "  " }] }, teacher_found: true })) };
    expect(toParticipants(l)).toEqual({ teacher: { display_name: "T" }, students: [] });
  });

  it("checks name length without echoing names", () => {
    const l = setTeacher(fromParsed(parsed({ participants: { teacher: null, students: [{ display_name: "x".repeat(201) }, { display_name: "T" }] } })), "");
    const withTeacher = setTeacher(l, l.rows[1]?.key ?? "");
    expect(listProblem(withTeacher)).toMatch(/longer than 200 characters/);
    expect(listProblem(withTeacher)).not.toContain("xxx");
  });

  it("summarises what was read", () => {
    expect(fromParsed(parsed()).summary).toBe("3 rows read, 1 dropped (phone numbers or meeting bots).");
  });
});

describe("chat file", () => {
  it("accepts small .txt and .csv files only", () => {
    expect(checkChatFile({ name: "chat.txt", type: "", size: 10 })).toEqual({ ok: true, contentType: "text/plain" });
    expect(checkChatFile({ name: "chat.CSV", type: "", size: 10 })).toEqual({ ok: true, contentType: "text/csv" });
    expect(checkChatFile({ name: "chat.docx", type: "application/msword", size: 10 }).ok).toBe(false);
    expect(checkChatFile({ name: "chat.txt", type: "text/plain", size: 2 * 1024 * 1024 }).ok).toBe(false);
    expect(checkChatFile({ name: "chat.txt", type: "text/plain", size: 0 }).ok).toBe(false);
  });
});
