import type { ReactNode } from "react";
import { FieldError, Input, Label, RadioButton, RadioField, RadioGroup, TextArea, TextField } from "react-aria-components";
import type { FieldProblem } from "~/api/client";
import type { MetadataDraft } from "~/upload/store";

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

const BOARDS = ["CBSE", "ICSE", "IGCSE"];
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
const labelCls = "t-small font-semibold";

interface Props {
  draft: MetadataDraft;
  onChange: (d: MetadataDraft) => void;
  errors: Partial<Record<DraftField, string>>;
  teacherPicker: ReactNode;
}

export function MetadataForm({ draft, onChange, errors, teacherPicker }: Props) {
  const set = <K extends DraftField>(k: K, v: MetadataDraft[K]) => {
    onChange({ ...draft, [k]: v });
  };
  return (
    <div className="space-y-7">
      {teacherPicker}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField value={draft.board} onChange={(v) => { set("board", v); }} isRequired isInvalid={Boolean(errors.board)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Board</Label>
          <Input className={input} list="boards" placeholder="CBSE, ICSE or IGCSE" />
          <datalist id="boards">
            {BOARDS.map((b) => <option key={b} value={b} />)}
          </datalist>
          <FieldError className="t-small">{errors.board}</FieldError>
        </TextField>
        <TextField value={draft.subject} onChange={(v) => { set("subject", v); }} isRequired isInvalid={Boolean(errors.subject)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Subject</Label>
          <Input className={input} list="subjects" />
          <datalist id="subjects">
            {SUBJECTS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <FieldError className="t-small">{errors.subject}</FieldError>
        </TextField>
      </div>

      <RadioGroup value={draft.grade} onChange={(v) => { set("grade", v); }} isRequired isInvalid={Boolean(errors.grade)} orientation="horizontal" className="flex flex-col gap-1.5">
        <Label className={labelCls}>Grade</Label>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Choice key={g} value={g}>
              Grade {g}
            </Choice>
          ))}
        </div>
        <FieldError className="t-small">{errors.grade}</FieldError>
      </RadioGroup>

      <TextField value={draft.chapter} onChange={(v) => { set("chapter", v); }} isRequired isInvalid={Boolean(errors.chapter)} className="flex flex-col gap-1.5">
        <Label className={labelCls}>Chapter</Label>
        <Input className={input} aria-describedby="chapter-hint" />
        <p id="chapter-hint" className="t-small text-slate">
          As the textbook names it, for example "Surface Areas and Volumes". It's the lecture's title, and it's used to find the chapter's objectives.
        </p>
        <FieldError className="t-small">{errors.chapter}</FieldError>
      </TextField>

      <RadioGroup value={draft.class_type} onChange={(v) => { set("class_type", v === "online" || v === "in_person" ? v : ""); }} isRequired isInvalid={Boolean(errors.class_type)} orientation="horizontal" className="flex flex-col gap-1.5">
        <Label className={labelCls}>Class type</Label>
        <div className="flex flex-wrap gap-2">
          <Choice value="online">Online</Choice>
          <Choice value="in_person">In person</Choice>
        </div>
        <FieldError className="t-small">{errors.class_type}</FieldError>
      </RadioGroup>

      <RadioGroup
        value={draft.class_composition}
        onChange={(v) => { set("class_composition", v === "co_ed" || v === "girls" || v === "boys" ? v : "unknown"); }}
        orientation="horizontal"
        className="flex flex-col gap-1.5"
        aria-describedby="composition-why"
      >
        <Label className={labelCls}>Who was in the class</Label>
        <div className="flex flex-wrap gap-2">
          <Choice value="co_ed">Girls and boys</Choice>
          <Choice value="girls">Girls only</Choice>
          <Choice value="boys">Boys only</Choice>
          <Choice value="unknown">Not sure</Choice>
        </div>
        <p id="composition-why" className="t-small measure text-slate">
          This changes how remarks about gender are judged. In a girls-only or boys-only class, addressing the class as "girls" or
          "boys" isn't treated as gendered language. When this is "Not sure", such remarks are held back rather than reported.
        </p>
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
        <TextField value={draft.lesson_plan} onChange={(v) => { set("lesson_plan", v); }} isInvalid={Boolean(errors.lesson_plan)} className="flex flex-col gap-1.5">
          <Label className={labelCls}>Lesson plan</Label>
          <TextArea className={`${input} min-h-28`} aria-describedby="plan-hint" />
          <p id="plan-hint" className="t-small text-slate">
            Paste it as text if you have one. Each line of it is also read as an objective.
          </p>
          <FieldError className="t-small">{errors.lesson_plan}</FieldError>
        </TextField>
      </section>
    </div>
  );
}

function Choice({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadioField value={value}>
      <RadioButton className="t-ui inline-block cursor-pointer rounded-full border border-slate px-4 py-1.5 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet">
        {children}
      </RadioButton>
    </RadioField>
  );
}
