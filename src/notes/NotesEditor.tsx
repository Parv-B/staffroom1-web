import { useId, type ReactNode } from "react";
import { Button, Input, Label, TextArea, TextField } from "react-aria-components";
import type { Segment } from "~/analysis/types.gen";
import { SPEAKER_LABEL } from "~/components/TranscriptLines";
import { mmss } from "~/lib/format";
import {
  MAX_CITED,
  emptyBullet,
  emptySection,
  move,
  problemsAt,
  type Draft,
  type DraftBullet,
  type DraftSection,
  type Problem,
  type Target,
} from "./model";

export interface EditorProps {
  draft: Draft;
  problems: readonly Problem[];
  segmentsById: ReadonlyMap<string, Segment>;
  activeBullet: string | null;
  onChange: (next: Draft, edited: Target | null) => void;
  onChooseLines: (sectionKey: string, bulletKey: string) => void;
}

/** Headings and bullets as fields. Each bullet keeps its cited lines, chosen in the transcript
 *  panel. Problems (from the checks or from the API) sit under the field they're about. */
export function NotesEditor({ draft, problems, segmentsById, activeBullet, onChange, onChooseLines }: EditorProps) {
  const setSection = (i: number, s: DraftSection, edited: Target | null) => {
    onChange(
      draft.map((x, k) => (k === i ? s : x)),
      edited,
    );
  };
  return (
    <div className="space-y-12">
      {draft.map((s, i) => (
        <SectionEditor
          key={s.key}
          section={s}
          index={i}
          count={draft.length}
          problems={problems}
          segmentsById={segmentsById}
          activeBullet={activeBullet}
          onChange={(next, edited) => {
            setSection(i, next, edited);
          }}
          onMove={(by) => {
            onChange(move(draft, i, by), null);
          }}
          onRemove={() => {
            onChange(
              draft.filter((x) => x.key !== s.key),
              null,
            );
          }}
          onChooseLines={onChooseLines}
        />
      ))}
      <Button
        className="button"
        onPress={() => {
          onChange([...draft, emptySection()], null);
        }}
      >
        Add a section
      </Button>
    </div>
  );
}

function SectionEditor({
  section: s,
  index,
  count,
  problems,
  segmentsById,
  activeBullet,
  onChange,
  onMove,
  onRemove,
  onChooseLines,
}: {
  section: DraftSection;
  index: number;
  count: number;
  problems: readonly Problem[];
  segmentsById: ReadonlyMap<string, Segment>;
  activeBullet: string | null;
  onChange: (s: DraftSection, edited: Target | null) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onChooseLines: (sectionKey: string, bulletKey: string) => void;
}) {
  const headingTarget: Target = { kind: "heading", section: s.key };
  const bulletsTarget: Target = { kind: "bullets", section: s.key };
  const headingProblems = problemsAt(problems, headingTarget);
  const listProblems = problemsAt(problems, bulletsTarget);
  const n = (index + 1).toString();
  const setBullet = (j: number, b: DraftBullet, edited: Target | null) => {
    onChange({ ...s, bullets: s.bullets.map((x, k) => (k === j ? b : x)) }, edited);
  };
  return (
    <section aria-label={`Section ${n}`} className="border-l-2 border-dashed border-slate/60 pl-4 sm:pl-6" data-section-key={s.key}>
      <Field problems={headingProblems}>
        {(describedBy) => (
          <TextField
            value={s.heading}
            onChange={(v) => {
              onChange({ ...s, heading: v }, headingTarget);
            }}
            isInvalid={headingProblems.length > 0}
            className="flex flex-col gap-1"
          >
            <Label className="t-small font-semibold text-slate">Section {n} heading</Label>
            <Input
              aria-describedby={describedBy}
              data-problem-target={JSON.stringify(headingTarget)}
              className="t-subheading w-full rounded-[3px] border border-slate/60 bg-sheet px-2 py-1 data-[invalid]:border-ochre data-[invalid]:border-2"
            />
          </TextField>
        )}
      </Field>
      <ItemControls
        what={`section ${n}`}
        index={index}
        count={count}
        onMove={onMove}
        onRemove={onRemove}
        removeLabel="Remove section"
      />
      <ol className="mt-4 list-none space-y-6 p-0">
        {s.bullets.map((b, j) => (
          <BulletEditor
            key={b.key}
            sectionKey={s.key}
            bullet={b}
            label={`Bullet ${(j + 1).toString()} of section ${n}`}
            index={j}
            count={s.bullets.length}
            problems={problems}
            segmentsById={segmentsById}
            isActive={activeBullet === b.key}
            onChange={(next, edited) => {
              setBullet(j, next, edited);
            }}
            onMove={(by) => {
              onChange({ ...s, bullets: move(s.bullets, j, by) }, null);
            }}
            onRemove={() => {
              onChange({ ...s, bullets: s.bullets.filter((x) => x.key !== b.key) }, null);
            }}
            onChooseLines={() => {
              onChooseLines(s.key, b.key);
            }}
          />
        ))}
      </ol>
      <ProblemList problems={listProblems} id={`p-${s.key}-bullets`} />
      <Button
        className="action t-small mt-3"
        onPress={() => {
          onChange({ ...s, bullets: [...s.bullets, emptyBullet()] }, bulletsTarget);
        }}
      >
        Add a bullet to section {n}
      </Button>
    </section>
  );
}

function BulletEditor({
  sectionKey,
  bullet: b,
  label,
  index,
  count,
  problems,
  segmentsById,
  isActive,
  onChange,
  onMove,
  onRemove,
  onChooseLines,
}: {
  sectionKey: string;
  bullet: DraftBullet;
  label: string;
  index: number;
  count: number;
  problems: readonly Problem[];
  segmentsById: ReadonlyMap<string, Segment>;
  isActive: boolean;
  onChange: (b: DraftBullet, edited: Target | null) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onChooseLines: () => void;
}) {
  const textTarget: Target = { kind: "text", section: sectionKey, bullet: b.key };
  const citeTarget: Target = { kind: "citations", section: sectionKey, bullet: b.key };
  const textProblems = problemsAt(problems, textTarget);
  const citeProblems = problemsAt(problems, citeTarget);
  const citeId = useId();
  return (
    <li className={`measure border-l-[3px] py-1 pl-3 ${isActive ? "border-pen" : "border-transparent"}`} data-bullet-key={b.key}>
      <Field problems={textProblems}>
        {(describedBy) => (
          <TextField
            value={b.text}
            onChange={(v) => {
              onChange({ ...b, text: v }, textTarget);
            }}
            isInvalid={textProblems.length > 0}
            className="flex flex-col gap-1"
          >
            <Label className="t-small font-semibold text-slate">{label}</Label>
            <TextArea
              rows={2}
              aria-describedby={describedBy}
              data-problem-target={JSON.stringify(textTarget)}
              className="t-reading field-sizing-content min-h-[3.5rem] w-full rounded-[3px] border border-slate/60 bg-sheet px-2 py-1 data-[invalid]:border-ochre data-[invalid]:border-2"
            />
          </TextField>
        )}
      </Field>
      <div className="mt-2" role="group" aria-labelledby={citeId}>
        <p id={citeId} className="t-small m-0 font-semibold text-slate">
          Based on {b.segmentIds.length === 0 ? "no transcript lines yet" : b.segmentIds.length === 1 ? "1 transcript line" : `${b.segmentIds.length.toString()} transcript lines`}
          <span className="font-normal"> (1 to {MAX_CITED.toString()})</span>
        </p>
        {b.segmentIds.length > 0 ? (
          <ul className="mt-1 list-none space-y-1 p-0">
            {b.segmentIds.map((id) => {
              const s = segmentsById.get(id);
              return (
                <li key={id} className="t-small grid grid-cols-[3.25rem_1fr_auto] items-start gap-x-2">
                  <span className="nums">{s ? mmss(s.start_ms) : "?"}</span>
                  {s ? (
                    <span className="line-clamp-2">
                      <span className="font-semibold">{SPEAKER_LABEL[s.speaker]}</span> <span className="font-reading">{s.text}</span>
                    </span>
                  ) : (
                    <span className="text-lagoon">This line is no longer in the transcript.</span>
                  )}
                  <Button
                    className="action"
                    aria-label={`Stop citing ${s ? mmss(s.start_ms) : "the missing line"} in ${label.toLowerCase()}`}
                    onPress={() => {
                      onChange({ ...b, segmentIds: b.segmentIds.filter((x) => x !== id) }, citeTarget);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ProblemList problems={citeProblems} id={`p-${b.key}-cites`} />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button className="action t-small" onPress={onChooseLines} aria-pressed={isActive} data-problem-target={JSON.stringify(citeTarget)}>
            {isActive ? "Choosing lines in the transcript" : `Choose lines for ${label.toLowerCase()}`}
          </Button>
          <ItemControls what={label.toLowerCase()} index={index} count={count} onMove={onMove} onRemove={onRemove} removeLabel="Remove bullet" inline />
        </div>
      </div>
    </li>
  );
}

function ItemControls({
  what,
  index,
  count,
  onMove,
  onRemove,
  removeLabel,
  inline = false,
}: {
  what: string;
  index: number;
  count: number;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  removeLabel: string;
  inline?: boolean;
}) {
  const cls = "action t-small data-[disabled]:cursor-default data-[disabled]:text-slate data-[disabled]:no-underline";
  const body = (
    <>
      <Button className={cls} isDisabled={index === 0} onPress={() => { onMove(-1); }} aria-label={`Move ${what} up`}>
        Move up
      </Button>
      <Button className={cls} isDisabled={index === count - 1} onPress={() => { onMove(1); }} aria-label={`Move ${what} down`}>
        Move down
      </Button>
      <Button className={cls} onPress={onRemove} aria-label={`${removeLabel}: ${what}`}>
        {removeLabel}
      </Button>
    </>
  );
  return inline ? body : <div className="mt-1 flex flex-wrap gap-x-4">{body}</div>;
}

function Field({ problems, children }: { problems: readonly Problem[]; children: (describedBy: string | undefined) => ReactNode }) {
  const id = useId();
  return (
    <div>
      {children(problems.length > 0 ? id : undefined)}
      <ProblemList problems={problems} id={id} />
    </div>
  );
}

/** A problem reads as a plain instruction in the review hue with a marker, never as red. */
export function ProblemList({ problems, id }: { problems: readonly Problem[]; id: string }) {
  if (problems.length === 0) return null;
  const unique = [...new Map(problems.map((p) => [p.type, p])).values()];
  return (
    <ul id={id} className="t-small mt-1 mb-0 list-none space-y-0.5 p-0 text-ochre" data-problems>
      {unique.map((p) => (
        <li key={p.type} className="flex gap-1.5">
          <span aria-hidden="true" className="font-semibold">
            !
          </span>
          <span>{p.message}</span>
        </li>
      ))}
    </ul>
  );
}
