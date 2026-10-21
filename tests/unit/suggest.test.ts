import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "~/api/client";
import { EMPTY_DRAFT } from "~/lectures/MetadataForm";
import { EMPTY_ASSIST, applySuggestion, fetchSuggestion, keepField, noteEdits, objectivesToSubmit, type Suggestion } from "~/lectures/suggest";

function suggestion(over: Partial<Suggestion> = {}): Suggestion {
  return {
    upload_id: "up_1",
    cached: false,
    created_at: "2026-10-21T10:00:00Z",
    cost_usd: 0.04,
    timings_s: {},
    objectives: ["Find the volume of a combined solid"],
    fields: {
      board: { value: "CBSE", confidence: 0.9, reason: "At 04:31 'NCERT exercise 12.1'" },
      grade: { value: "10", confidence: 0.85, reason: "At 04:31 'class 10'" },
      subject: { value: "Mathematics", confidence: 0.95, reason: "Chapter is maths" },
      chapter: { value: "Surface Areas and Volumes", confidence: 0.9, reason: "At 05:02 'surface area volume'" },
      class_type: { value: "online", confidence: 0.8, reason: "At 05:55 'switch on your camera'" },
      class_composition: { value: "unknown", confidence: 0.8, reason: "Not addressed" },
    },
    reason_if_unavailable: null,
    ...over,
  };
}

describe("AI-suggested lecture details", () => {
  it("fills empty, untouched fields and marks each with its reason", () => {
    const r = applySuggestion(EMPTY_DRAFT, EMPTY_ASSIST, suggestion());
    expect(r.draft).toMatchObject({ board: "CBSE", grade: "10", subject: "Mathematics", chapter: "Surface Areas and Volumes", class_type: "online" });
    expect(r.assist.marks.class_type).toEqual({ reason: "At 05:55 'switch on your camera'", tentative: false });
    expect(r.assist.marks.class_composition).toBeUndefined(); // "unknown" is the default, not a suggestion
    expect(r.assist.objectives).toEqual([{ text: "Find the volume of a combined solid", kept: false }]);
    expect(r.filled).toBe(6);
  });

  it("never overwrites what the teacher typed or chose, even to clear it", () => {
    const typed = noteEdits(EMPTY_DRAFT, { ...EMPTY_DRAFT, chapter: "Triangles" }, EMPTY_ASSIST);
    const cleared = noteEdits({ ...EMPTY_DRAFT, board: "ICSE" }, { ...EMPTY_DRAFT, board: "" }, typed);
    const r = applySuggestion({ ...EMPTY_DRAFT, chapter: "Triangles" }, cleared, suggestion());
    expect(r.draft.chapter).toBe("Triangles");
    expect(r.draft.board).toBe(""); // emptied on purpose by the teacher: left empty
    expect(r.assist.marks.chapter).toBeUndefined();
    expect(r.assist.marks.board).toBeUndefined();
  });

  it("marks low-confidence suggestions as tentative and skips null or invalid values", () => {
    const s = suggestion({
      fields: {
        board: { value: "CBSE", confidence: 0.4, reason: "from history" },
        grade: { value: "Class X", confidence: 0.9, reason: "not normalised" },
        subject: { value: null, confidence: 0, reason: "not said" },
      },
    });
    const r = applySuggestion(EMPTY_DRAFT, EMPTY_ASSIST, s);
    expect(r.assist.marks.board).toEqual({ reason: "from history", tentative: true });
    expect(r.draft.grade).toBe("");
    expect(r.draft.subject).toBe("");
  });

  it("changes nothing when the backend says there is no suggestion", () => {
    const r = applySuggestion(EMPTY_DRAFT, EMPTY_ASSIST, suggestion({ reason_if_unavailable: "no speech in the first 10 minutes" }));
    expect(r.draft).toEqual(EMPTY_DRAFT);
    expect(r.filled).toBe(0);
  });

  it("clears a mark when the teacher edits or keeps the field", () => {
    const r = applySuggestion(EMPTY_DRAFT, EMPTY_ASSIST, suggestion());
    const edited = noteEdits(r.draft, { ...r.draft, chapter: "Surface Areas" }, r.assist);
    expect(edited.marks.chapter).toBeUndefined();
    expect(keepField(r.assist, "board").marks.board).toBeUndefined();
    // A later "Suggest again" doesn't overwrite a field the teacher kept.
    const again = applySuggestion(r.draft, keepField(r.assist, "board"), suggestion({ fields: { board: { value: "ICSE", confidence: 0.9, reason: "x" } } }));
    expect(again.draft.board).toBe("CBSE");
  });

  it("submits the teacher's objectives and the suggested ones not removed, once each", () => {
    const r = applySuggestion({ ...EMPTY_DRAFT, objectives: "My own objective\nfind the volume of a combined solid" }, EMPTY_ASSIST, suggestion({ objectives: ["Find the volume of a combined solid", "Use conservation of volume"] }));
    expect(objectivesToSubmit(r.draft, r.assist)).toEqual(["My own objective", "find the volume of a combined solid", "Use conservation of volume"]);
  });
});

describe("calling the endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const err = (status: number, code: string) => Promise.resolve({ error: { error: { code, message: "" } }, response: new Response(null, { status }) });

  it("treats 404 not_enabled as switched off", async () => {
    vi.spyOn(api, "POST").mockImplementation(() => err(404, "not_enabled"));
    expect(await fetchSuggestion("up_1", {})).toEqual({ kind: "off" });
  });

  it("waits out 409 suggestion_in_progress and collects the stored result without re-running", async () => {
    const calls: unknown[] = [];
    vi.spyOn(api, "POST").mockImplementation((_path: string, init: { params: { query: unknown } }) => {
      calls.push(init.params.query);
      return calls.length === 1 ? err(409, "suggestion_in_progress") : Promise.resolve({ data: suggestion({ cached: true }), response: new Response(null, { status: 200 }) });
    });
    const out = await fetchSuggestion("up_1", { refresh: true, sleep: () => Promise.resolve() });
    expect(out.kind).toBe("result");
    expect(calls).toEqual([{ refresh: true }, { refresh: false }]);
  });

  it("reports any other failure as no suggestion", async () => {
    vi.spyOn(api, "POST").mockImplementation(() => err(500, "internal_error"));
    expect(await fetchSuggestion("up_1", {})).toEqual({ kind: "failed" });
  });
});
