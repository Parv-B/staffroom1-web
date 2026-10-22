import { describe, expect, it } from "vitest";
import { checkDraft, clean, dropApiProblemsFor, isChanged, placeApiProblems, problemsAt, toDraft, toNotesIn, toggleCitation, type Draft } from "~/notes/model";

const sections = [
  { heading: "One", bullets: [{ text: "A.", segment_ids: ["s1"] }, { text: "B.", segment_ids: ["s2", "s3"] }] },
  { heading: "Two", bullets: [{ text: "C.", segment_ids: ["s3"] }] },
];
const known = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);

describe("notes editor model", () => {
  it("round-trips the API's sections", () => {
    const d = toDraft(sections);
    expect(toNotesIn(d).sections).toEqual(sections);
    expect(isChanged(d, sections)).toBe(false);
  });

  it("checks what the API checks, attached to the item", () => {
    const d: Draft = toDraft([
      { heading: "  ", bullets: [] },
      { heading: "Fine", bullets: [{ text: " \n ", segment_ids: [] }, { text: "Ask a student.", segment_ids: ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] }, { text: "Ok.", segment_ids: ["gone"] }] },
    ]);
    const p = checkDraft(d, known);
    const [s0, s1] = d as [Draft[number], Draft[number]];
    expect(problemsAt(p, { kind: "heading", section: s0.key }).map((x) => x.type)).toEqual(["empty_heading"]);
    expect(problemsAt(p, { kind: "bullets", section: s0.key }).map((x) => x.type)).toEqual(["no_bullets"]);
    const [b0, b1, b2] = s1.bullets as [Draft[number]["bullets"][number], Draft[number]["bullets"][number], Draft[number]["bullets"][number]];
    expect(problemsAt(p, { kind: "text", section: s1.key, bullet: b0.key }).map((x) => x.type)).toEqual(["empty_text"]);
    expect(problemsAt(p, { kind: "citations", section: s1.key, bullet: b0.key }).map((x) => x.type)).toEqual(["no_evidence"]);
    expect(problemsAt(p, { kind: "text", section: s1.key, bullet: b1.key })).toEqual([]);
    expect(problemsAt(p, { kind: "citations", section: s1.key, bullet: b1.key }).map((x) => x.type)).toEqual(["too_many_segments"]);
    expect(problemsAt(p, { kind: "citations", section: s1.key, bullet: b2.key }).map((x) => x.type)).toEqual(["unknown_segment"]);
    expect(checkDraft(toDraft(sections), known)).toEqual([]);
  });

  it("cleans text like the API (whitespace and leading list markers)", () => {
    expect(clean("  - *  Two   words ")).toBe("Two words");
    expect(clean(" \n ")).toBe("");
    expect(clean("-")).toBe("-"); // a lone marker is text, as in the API
  });

  it("places the API's 422 field locations on the heading or bullet as it was sent", () => {
    const d = toDraft(sections);
    const placed = placeApiProblems(
      [
        { loc: ["body", "sections", 1, "bullets", 0, "text"], msg: "", type: "empty_text" },
        { loc: ["body", "sections", 0, "heading"], msg: "", type: "empty_heading" },
        { loc: ["body", "sections", 0, "bullets", 1, "segment_ids"], msg: "", type: "unknown_segment" },
        { loc: ["body", "sections", 0, "bullets"], msg: "", type: "no_bullets" },
        { loc: ["body", "sections", 9, "heading"], msg: "", type: "empty_heading" },
        { loc: ["body"], msg: "", type: "too_short" },
      ],
      d,
    );
    const [s0, s1] = d as [Draft[number], Draft[number]];
    expect(placed.map((p) => p.target)).toEqual([
      { kind: "text", section: s1.key, bullet: s1.bullets[0]?.key },
      { kind: "heading", section: s0.key },
      { kind: "citations", section: s0.key, bullet: s0.bullets[1]?.key },
      { kind: "bullets", section: s0.key },
      { kind: "notes" },
      { kind: "notes" },
    ]);
    // The message never repeats the teacher's text.
    expect(placed[0]?.message).toMatch(/Write something for this bullet/);
    expect(placed[0]?.message).not.toContain("C.");
  });

  it("an API problem stays put while items move, and clears when its item is edited", () => {
    const d = toDraft(sections);
    const [s0, s1] = d as [Draft[number], Draft[number]];
    const placed = placeApiProblems([{ loc: ["body", "sections", 1, "bullets", 0, "text"], msg: "", type: "name" }], d);
    const target = { kind: "text", section: s1.key, bullet: s1.bullets[0]?.key ?? "" } as const;
    expect(problemsAt(placed, target)).toHaveLength(1);
    expect(dropApiProblemsFor(placed, { kind: "text", section: s0.key, bullet: s0.bullets[0]?.key ?? "" })).toHaveLength(1);
    expect(dropApiProblemsFor(placed, target)).toHaveLength(0);
  });

  it("keeps citations in transcript order", () => {
    const d = toDraft(sections);
    const s0 = d[0];
    const b = s0?.bullets[1];
    if (!s0 || !b) throw new Error("fixture");
    const order = new Map([["s1", 0], ["s2", 1], ["s3", 2]]);
    const added = toggleCitation(d, s0.key, b.key, "s1", order);
    expect(added[0]?.bullets[1]?.segmentIds).toEqual(["s1", "s2", "s3"]);
    const removed = toggleCitation(added, s0.key, b.key, "s2", order);
    expect(removed[0]?.bullets[1]?.segmentIds).toEqual(["s1", "s3"]);
  });
});
