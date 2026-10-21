import type { ReactNode } from "react";
import { Button, FieldError, Input, Label, RadioButton, RadioField, RadioGroup, Text, TextArea, TextField } from "react-aria-components";
import type { FieldProblem } from "~/api/client";
import { StatusMark } from "~/components/StatusMark";
import type { MetadataDraft } from "~/upload/store";
import type { FormAssist, Mark, SuggestableField } from "./suggest";

export const EMPTY_DRAFT: MetadataDraft = {
  board: "",
  grade: "",
  subject: "",
  chapter: "",
  class_type: "",
  class_composition: "unknown",
  lesson_plan: "",
  objectives: "",
  teacher_user_id: "",
};

const BOARDS = ["CBSE", "ICSE", "ISC", "IGCSE"];
const GRADES = ["9", "10", "11", "12"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Science", "English", "Economics", "Accountancy", "Business Studies", "Computer Science"];

export type DraftField = keyof MetadataDraft;

/** Maps the API's validation `loc` (e.g. ["body","metadata","chapter"]) to a form field. */
export function fieldFor(p: FieldProblem): DraftField | null {
  const names: DraftField[] = ["board", "grade", "subject", "chapter", "class_type", "class_composition", "lesson_plan", "objectives", "teacher_user_id"];
  for (const part of [...p.loc].reverse()) if (typeof part === "string" && (names as string[]).includes(part)) return part as DraftField;
  return null;
}

const input = "t-ui w-full rounded-[3px] border border-slate bg-sheet px-3 py-2 data-[invalid]:border-2 data-[invalid]:border-ink";
// A value the teacher hasn't confirmed yet is outlined in dashes, like any other draft.
const provisional = "border-dashed";
const labelCls = "t-small font-semibold";

interface Props {
  draft: MetadataDraft;
  onChange: (d: MetadataDraft) => void;
  errors: Partial<Record<DraftField, string>>;
  teacherPicker: ReactNode;
  assist: FormAssist;
  onKeep: (field: SuggestableField) => void;
  onKeepObjective: (index: number) => void;
  onRemoveObjective: (index: number) => void;
}

export function MetadataForm({ draft, onChange, errors, teacherPicker, assist, onKeep, onKeepObjective, onRemoveObjective }: Props) {
  const set = <K extends DraftField>(k: K, v: MetadataDraft[K]) => {
    onChange({ ...draft, [k]: v });
  };
  const m = assist.marks;
  const note = (f: SuggestableField) => {
    const mark = m[f];
    return mark ? <SuggestionNote mark={mark} onKeep={() => { onKeep(f); }} /> : null;
  };
  return (
    <div className="space-y-7">
      {teacherPicker}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField value={draft.board} onChange={(v) => { set("board", v); }} isRequired isInvalid={Boolean(errors.board)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Board</Label>
          <Input className={`${input} ${m.board ? provisional : ""}`} list="boards" placeholder="CBSE, ICSE or IGCSE" />
          <datalist id="boards">
            {BOARDS.map((b) => <option key={b} value={b} />)}
          </datalist>
          {note("board")}
          <FieldError className="t-small">{errors.board}</FieldError>
        </TextField>
        <TextField value={draft.subject} onChange={(v) => { set("subject", v); }} isRequired isInvalid={Boolean(errors.subject)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Subject</Label>
          <Input className={`${input} ${m.subject ? provisional : ""}`} list="subjects" />
          <datalist id="subjects">
            {SUBJECTS.map((s) => <option key={s} value={s} />)}
          </datalist>
          {note("subject")}
          <FieldError className="t-small">{errors.subject}</FieldError>
        </TextField>
      </div>

      <RadioGroup value={draft.grade} onChange={(v) => { set("grade", v); }} isRequired isInvalid={Boolean(errors.grade)} orientation="horizontal" className="flex flex-col gap-1.5">
        <Label className={labelCls}>Grade</Label>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Choice key={g} value={g} provisional={Boolean(m.grade)}>
              Grade {g}
            </Choice>
          ))}
        </div>
        {note("grade")}
        <FieldError className="t-small">{errors.grade}</FieldError>
      </RadioGroup>

      <TextField value={draft.chapter} onChange={(v) => { set("chapter", v); }} isRequired isInvalid={Boolean(errors.chapter)} className="flex flex-col gap-1.5">
        <Label className={labelCls}>Chapter</Label>
        <Input className={`${input} ${m.chapter ? provisional : ""}`} />
        <Text slot="description" className="t-small text-slate">
          As the textbook names it, for example "Surface Areas and Volumes". It's the lecture's title, and it's used to find the chapter's objectives.
        </Text>
        {note("chapter")}
        <FieldError className="t-small">{errors.chapter}</FieldError>
      </TextField>

      <RadioGroup value={draft.class_type} onChange={(v) => { set("class_type", v === "online" || v === "in_person" ? v : ""); }} isRequired isInvalid={Boolean(errors.class_type)} orientation="horizontal" className="flex flex-col gap-1.5">
        <Label className={labelCls}>Class type</Label>
        <div className="flex flex-wrap gap-2">
          <Choice value="online" provisional={Boolean(m.class_type)}>Online</Choice>
          <Choice value="in_person" provisional={Boolean(m.class_type)}>In person</Choice>
        </div>
        {note("class_type")}
        <FieldError className="t-small">{errors.class_type}</FieldError>
      </RadioGroup>

      <RadioGroup
        value={draft.class_composition}
        onChange={(v) => { set("class_composition", v === "co_ed" || v === "girls" || v === "boys" ? v : "unknown"); }}
        orientation="horizontal"
        className="flex flex-col gap-1.5"
      >
        <Label className={labelCls}>Who was in the class</Label>
        <div className="flex flex-wrap gap-2">
          <Choice value="co_ed" provisional={Boolean(m.class_composition)}>Girls and boys</Choice>
          <Choice value="girls" provisional={Boolean(m.class_composition)}>Girls only</Choice>
          <Choice value="boys" provisional={Boolean(m.class_composition)}>Boys only</Choice>
          <Choice value="unknown">Not sure</Choice>
        </div>
        <Text slot="description" className="t-small measure text-slate">
          This changes how remarks about gender are judged. In a girls-only or boys-only class, addressing the class as "girls" or
          "boys" isn't treated as gendered language. When this is "Not sure", such remarks are held back rather than reported.
        </Text>
        {note("class_composition")}
      </RadioGroup>

      <section aria-labelledby="objectives-heading" className="space-y-4">
        <h3 id="objectives-heading" className="t-subheading">
          What this lesson set out to cover
        </h3>
        <p className="t-reading measure text-slate">
          Optional, but it changes how coverage is judged. With your own objectives, the analysis checks the lesson against them,
          and an objective it didn't reach is shown as a gap. Without them, objectives come from the chapter's syllabus (or a
          generated list that no one has reviewed yet), and anything the lesson didn't reach is shown as "not in this lesson",
          because one lecture rarely covers a whole chapter.
        </p>
        <TextField value={draft.objectives} onChange={(v) => { set("objectives", v); }} isInvalid={Boolean(errors.objectives)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Learning objectives, one per line</Label>
          <TextArea className={`${input} min-h-28`} placeholder={"Find the surface area of a solid made of two basic solids\nAvoid counting the joined faces twice"} />
          <FieldError className="t-small">{errors.objectives}</FieldError>
        </TextField>
        {assist.objectives.length > 0 ? (
          <div data-suggested-objectives>
            <p className="t-small m-0 font-semibold">Objectives you stated in the recording</p>
            <p className="t-small m-0 text-slate">These are included unless you remove them. Since they'd be your lesson's own objectives, one the lesson didn't reach would count as a gap.</p>
            <ul className="mt-2 list-none space-y-2 p-0">
              {assist.objectives.map((o, i) => (
                <li key={o.text} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1.5 rounded-[3px] border px-3 py-2 ${o.kept ? "border-slate/40" : "border-dashed border-slate"}`}>
                  <span className="t-ui w-full">{o.text}</span>
                  {o.kept ? <span className="t-small text-slate">Kept</span> : <StatusMark kind="suggested" />}
                  {!o.kept ? (
                    <Button className="action t-small" onPress={() => { onKeepObjective(i); }}>
                      Keep
                    </Button>
                  ) : null}
                  <Button className="action t-small" onPress={() => { onRemoveObjective(i); }} aria-label={`Remove objective: ${o.text}`}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <TextField value={draft.lesson_plan} onChange={(v) => { set("lesson_plan", v); }} isInvalid={Boolean(errors.lesson_plan)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Lesson plan</Label>
          <TextArea className={`${input} min-h-28`} />
          <Text slot="description" className="t-small text-slate">
            Paste it as text if you have one. Each line of it is also read as an objective.
          </Text>
          <FieldError className="t-small">{errors.lesson_plan}</FieldError>
        </TextField>
      </section>
    </div>
  );
}

/** The mark, the reason and a way to confirm, shown under a prefilled field. */
function SuggestionNote({ mark, onKeep }: { mark: Mark; onKeep: () => void }) {
  return (
    <div className="t-small flex flex-wrap items-baseline gap-x-2 gap-y-1" data-suggestion={mark.tentative ? "tentative" : "suggested"}>
      <StatusMark kind={mark.tentative ? "suggested-tentative" : "suggested"} />
      <span className={mark.tentative ? "text-heather" : "text-slate"}>
        {mark.tentative ? "Less certain. " : ""}
        {mark.reason ?? "No reason was given."}
      </span>
      <Button className="action" onPress={onKeep}>
        Keep
      </Button>
    </div>
  );
}

function Choice({ value, children, provisional: prov = false }: { value: string; children: ReactNode; provisional?: boolean }) {
  return (
    <RadioField value={value}>
      <RadioButton
        className={`t-ui inline-block cursor-pointer rounded-full border border-slate px-4 py-1.5 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet ${prov ? "data-[selected]:border-dashed data-[selected]:border-sheet data-[selected]:outline-2 data-[selected]:outline-dashed data-[selected]:outline-pen" : ""}`}
      >
        {children}
      </RadioButton>
    </RadioField>
  );
}
