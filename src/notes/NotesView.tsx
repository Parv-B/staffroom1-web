import type { Segment } from "~/analysis/types.gen";
import { NotesBullet } from "~/components/NotesBullet";
import { StatusMark } from "~/components/StatusMark";
import { longDate } from "~/lib/format";
import { notesLabels, type NotesOut } from "./model";

/** Rule 11: the notes' status, where they came from, and staleness, above everything else.
 *  Drafts are drafts; nothing here offers to send notes to students. */
export function NotesStatus({ notes, viewerIsTeacher }: { notes: NotesOut; viewerIsTeacher: boolean }) {
  const l = notesLabels(notes, viewerIsTeacher, longDate);
  return (
    <div className="measure space-y-2" data-notes-status={l.status}>
      <p className="m-0 flex flex-wrap items-center gap-2">
        {l.status === "approved" ? <StatusMark kind="approved">{l.statusText}</StatusMark> : <StatusMark kind="draft" />}
        {notes.stale ? <StatusMark kind="stale" /> : null}
      </p>
      {l.status === "draft" ? <p className="t-small m-0">{l.statusText}</p> : null}
      {l.stale ? (
        <p className="t-small m-0 border-l-4 border-lagoon bg-lagoon-tint px-3 py-2" data-stale>
          {l.stale}
          {viewerIsTeacher ? " Choose the transcript lines again for the bullets marked below, then save." : ""}
        </p>
      ) : null}
      {l.olderReport ? <p className="t-small m-0 text-slate">{l.olderReport}</p> : null}
      <p className="t-small m-0 text-slate">{l.sourceText}</p>
    </div>
  );
}

/** The notes as they read: draft notes sit behind a dashed pencil rule, approved ones behind a
 *  solid pen rule (docs/design-plan.md). */
export function NotesReading({ notes, segmentsById }: { notes: NotesOut; segmentsById: ReadonlyMap<string, Segment> }) {
  const approved = notes.status === "approved";
  return (
    <article
      className={`notes-print mt-8 space-y-10 border-l-2 pl-5 sm:pl-8 ${approved ? "border-solid border-pen" : "border-dashed border-slate"}`}
      aria-label="Lecture notes"
    >
      {notes.sections.map((s, i) => (
        <section key={i} aria-labelledby={`notes-h-${i.toString()}`}>
          <h2 id={`notes-h-${i.toString()}`} className="t-subheading measure m-0">
            {s.heading}
          </h2>
          <ul className="mt-3 list-disc space-y-4 pl-5">
            {s.bullets.map((b, j) => (
              <NotesBullet key={j} bullet={b} segmentsById={segmentsById} />
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
