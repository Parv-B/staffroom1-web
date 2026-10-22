// The lecture-notes editor's pure logic: the editable draft, the checks the API will run
// (so most problems show before saving), and mapping the API's 422 field locations back onto
// the heading or bullet they point at. Nothing here renders or logs note text.
import type { FieldProblem, Schemas } from "~/api/client";

export type NotesOut = Schemas["NotesOut"];
export type NotesIn = Schemas["NotesIn"];

/** Same limit as the backend (staffroom.notes.generate.MAX_IDS_PER_BULLET). */
export const MAX_CITED = 6;

export interface DraftBullet {
  readonly key: string;
  readonly text: string;
  readonly segmentIds: readonly string[];
}
export interface DraftSection {
  readonly key: string;
  readonly heading: string;
  readonly bullets: readonly DraftBullet[];
}
export type Draft = readonly DraftSection[];

let counter = 0;
/** A stable key per heading or bullet, so problems stay attached while items move. */
export function newKey(prefix: "s" | "b"): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}`;
}

export function toDraft(sections: NotesOut["sections"]): Draft {
  return sections.map((s) => ({
    key: newKey("s"),
    heading: s.heading,
    bullets: s.bullets.map((b) => ({ key: newKey("b"), text: b.text, segmentIds: [...b.segment_ids] })),
  }));
}

export function emptySection(): DraftSection {
  return { key: newKey("s"), heading: "", bullets: [emptyBullet()] };
}
export function emptyBullet(): DraftBullet {
  return { key: newKey("b"), text: "", segmentIds: [] };
}

export function toNotesIn(draft: Draft): NotesIn {
  return { sections: draft.map((s) => ({ heading: s.heading, bullets: s.bullets.map((b) => ({ text: b.text, segment_ids: [...b.segmentIds] })) })) };
}

/** True when the draft would save something different from `sections` (keys ignored). */
export function isChanged(draft: Draft, sections: NotesOut["sections"]): boolean {
  return JSON.stringify(toNotesIn(draft).sections) !== JSON.stringify(sections.map((s) => ({ heading: s.heading, bullets: s.bullets.map((b) => ({ text: b.text, segment_ids: b.segment_ids })) })));
}

// ------------------------------------------------------------------ problems

/** Where a problem sits: a section's heading, its bullet list, or one bullet's text or citations. */
export type Target =
  | { readonly kind: "heading"; readonly section: string }
  | { readonly kind: "bullets"; readonly section: string }
  | { readonly kind: "text"; readonly section: string; readonly bullet: string }
  | { readonly kind: "citations"; readonly section: string; readonly bullet: string }
  | { readonly kind: "notes" };

export interface Problem {
  readonly target: Target;
  readonly type: string;
  /** Plain words for the teacher. Never quotes their text or a detected name. */
  readonly message: string;
  /** "check": found before saving; "api": the API refused the save or approval. */
  readonly from: "check" | "api";
}

const MESSAGES: Readonly<Record<string, string>> = {
  empty_heading: "Give this section a heading.",
  no_bullets: "Add at least one bullet to this section, or remove the section.",
  empty_text: "Write something for this bullet, or remove it.",
  no_evidence: "Choose at least one transcript line that supports this bullet.",
  unknown_segment: "One of the cited lines is no longer in the transcript. Choose the lines again.",
  too_many_segments: `Cite at most ${MAX_CITED.toString()} transcript lines.`,
  string_too_long: "This is too long to save. Shorten it or split it.",
  too_long: "There are too many items here to save. Split them up.",
  too_short: "The notes need at least one section.",
};

export function problemMessage(type: string): string {
  return MESSAGES[type] ?? "The API couldn't accept this part of the notes. Check it and save again.";
}

/** Collapse whitespace and drop leading list markers, as the API does before checking. */
export function clean(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ").replace(/^(?:[-*•]\s+)+/, "");
}

/** The checks the API runs on a save (docs/api.md, "Lecture notes"). `knownIds` is the
 *  transcript's segment ids. */
export function checkDraft(draft: Draft, knownIds: ReadonlySet<string>): Problem[] {
  const out: Problem[] = [];
  const add = (target: Target, type: string) => out.push({ target, type, message: problemMessage(type), from: "check" });
  if (draft.length === 0) add({ kind: "notes" }, "too_short");
  for (const s of draft) {
    if (!clean(s.heading)) add({ kind: "heading", section: s.key }, "empty_heading");
    if (s.bullets.length === 0) add({ kind: "bullets", section: s.key }, "no_bullets");
    for (const b of s.bullets) {
      const text = { kind: "text", section: s.key, bullet: b.key } as const;
      const cites = { kind: "citations", section: s.key, bullet: b.key } as const;
      if (!clean(b.text)) add(text, "empty_text");
      if (b.segmentIds.length === 0) add(cites, "no_evidence");
      if (b.segmentIds.some((id) => !knownIds.has(id))) add(cites, "unknown_segment");
      if (new Set(b.segmentIds).size > MAX_CITED) add(cites, "too_many_segments");
    }
  }
  return out;
}

/** Maps the API's `fields[].loc` (e.g. ["body","sections",0,"bullets",1,"text"]) onto the draft
 *  as it was sent. A location that can't be placed becomes a problem with the notes as a whole,
 *  so nothing the API said is dropped. */
export function placeApiProblems(fields: readonly FieldProblem[], sent: Draft): Problem[] {
  return fields.map((f) => {
    const type = f.type || "unknown";
    const message = problemMessage(type);
    const loc = f.loc[0] === "body" ? f.loc.slice(1) : f.loc;
    const target = placeLoc(loc, sent);
    return { target, type, message, from: "api" as const };
  });
}

function placeLoc(loc: readonly (string | number)[], sent: Draft): Target {
  const [root, si, part, bi, leaf] = loc;
  if (root !== "sections" || typeof si !== "number") return { kind: "notes" };
  const s = sent[si];
  if (!s) return { kind: "notes" };
  if (part === "heading") return { kind: "heading", section: s.key };
  if (part !== "bullets") return { kind: "heading", section: s.key };
  if (typeof bi !== "number") return { kind: "bullets", section: s.key };
  const b = s.bullets[bi];
  if (!b) return { kind: "bullets", section: s.key };
  return leaf === "segment_ids" ? { kind: "citations", section: s.key, bullet: b.key } : { kind: "text", section: s.key, bullet: b.key };
}

export function sameTarget(a: Target, b: Target): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "notes" || b.kind === "notes") return true;
  if (a.section !== b.section) return false;
  if ((a.kind === "text" || a.kind === "citations") && (b.kind === "text" || b.kind === "citations")) return a.bullet === b.bullet;
  return true;
}

export function problemsAt(problems: readonly Problem[], target: Target): Problem[] {
  return problems.filter((p) => sameTarget(p.target, target));
}

/** API problems stay until the teacher edits the item they point at. */
export function dropApiProblemsFor(problems: readonly Problem[], target: Target): Problem[] {
  return problems.filter((p) => !(p.from === "api" && sameTarget(p.target, target)));
}

/** Count of distinct headings and bullets with something to fix, for the summary line. */
export function problemPlaces(problems: readonly Problem[]): number {
  return new Set(problems.map((p) => JSON.stringify(p.target))).size;
}

// ------------------------------------------------------------------ draft edits

export function toggleCitation(draft: Draft, sectionKey: string, bulletKey: string, segmentId: string, order: ReadonlyMap<string, number>): Draft {
  return draft.map((s) =>
    s.key !== sectionKey
      ? s
      : {
          ...s,
          bullets: s.bullets.map((b) => {
            if (b.key !== bulletKey) return b;
            const has = b.segmentIds.includes(segmentId);
            const ids = has ? b.segmentIds.filter((id) => id !== segmentId) : [...b.segmentIds, segmentId];
            // Transcript order, as the API stores them; unknown ids (stale) go last.
            return { ...b, segmentIds: [...ids].sort((x, y) => (order.get(x) ?? Infinity) - (order.get(y) ?? Infinity)) };
          }),
        },
  );
}

export function move<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return [...items];
  const out = [...items];
  const [it] = out.splice(index, 1);
  if (it !== undefined) out.splice(to, 0, it);
  return out;
}

// ------------------------------------------------------------------ labels (rule 11)

export interface NotesLabels {
  /** "draft" until the lecture's teacher approves. */
  readonly status: "draft" | "approved";
  readonly statusText: string;
  readonly sourceText: string;
  readonly stale: string | null;
  readonly olderReport: string | null;
}

export function notesLabels(n: NotesOut, viewerIsTeacher: boolean, date: (iso: string) => string): NotesLabels {
  const approved = n.status === "approved";
  const who = viewerIsTeacher ? "you" : "the teacher";
  return {
    status: approved ? "approved" : "draft",
    statusText: approved
      ? `Approved by ${who}${n.approved_at ? ` on ${date(n.approved_at)}` : ""}`
      : viewerIsTeacher
        ? "Students shouldn't get these notes until you approve them."
        : "The teacher hasn't approved these notes.",
    sourceText:
      n.source === "teacher"
        ? `${viewerIsTeacher ? "Your" : "The teacher's"} version${n.edited_at ? `, last saved on ${date(n.edited_at)}` : ""}.`
        : `Written by Staffroom1 from the transcript${viewerIsTeacher ? "; you haven't edited it yet" : "; the teacher hasn't edited it"}.`,
    stale: n.stale ? `Out of date: ${n.stale_reason ?? "the lecture was processed again since these notes were saved."}` : null,
    olderReport:
      !n.based_on_current_report && !n.stale
        ? `The lecture was processed again after ${viewerIsTeacher ? "you" : "the teacher"} saved these notes. They still match the transcript.`
        : null,
  };
}
