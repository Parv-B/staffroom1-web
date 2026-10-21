import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { can } from "~/auth/roles";
import { orgSummaryQuery } from "~/centre/queries";
import { StatusMark } from "~/components/StatusMark";
import { lectureTitle } from "~/lectures/vocab";
import { METRIC_DEFINITIONS } from "~/metrics/definitions.gen";
import { metricLabel } from "~/metrics/labels";
import { PROGRESS_METRICS, buildProgress, useTeacherLectures, type ProgressCell } from "~/progress/table";

export const Route = createFileRoute("/_app/progress")({
  validateSearch: (s: Record<string, unknown>): { teacher?: string } => (typeof s.teacher === "string" && s.teacher ? { teacher: s.teacher } : {}),
  component: Progress,
});

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Progress() {
  const { me } = Route.useRouteContext();
  const { teacher } = Route.useSearch();
  const isTeacher = me.role === "teacher";
  const org = useQuery({ ...orgSummaryQuery(), enabled: can.seeCentreSummary(me.role) });
  const teacherId = isTeacher ? me.user_id : (teacher ?? null);
  const lectures = useTeacherLectures(isTeacher ? null : teacherId, teacherId !== null);
  const teacherName = isTeacher ? null : (org.data?.teachers.find((t) => t.teacher_user_id === teacherId)?.display_name ?? null);

  return (
    <main className="pt-6">
      <h1 className="t-heading m-0">{isTeacher ? "Your measures over time" : teacherName ? `${teacherName}: measures over time` : "Measures over time"}</h1>
      <p className="t-reading measure mt-2 text-slate">
        {isTeacher ? "The measures from each of your analysed lectures, oldest first, exactly as each analysis gave them." : "One teacher's measures from each analysed lecture, oldest first, exactly as each analysis gave them."}{" "}
        They describe lessons; they don't judge them. Higher or lower isn't better in itself: what suits a lesson depends on its topic, its class and what it set out to do.
      </p>
      {isTeacher ? (
        <p className="t-small measure mt-2 text-slate">The centre's owner and admins can see these measures too, as they can in the lecture list. Findings and transcripts stay private unless you share a lecture.</p>
      ) : (
        <TeacherPicker teachers={org.data?.teachers ?? []} value={teacherId} />
      )}
      <div className="mt-6 bg-sheet px-5 pt-4 pb-12 sm:px-8">
        {teacherId === null ? (
          <p className="t-reading py-4">Choose a teacher to see their measures.</p>
        ) : lectures.isPending ? (
          <p className="t-reading py-4 text-slate">Loading the lectures</p>
        ) : lectures.isError ? (
          <p className="t-reading py-4" role="alert">
            The lectures couldn't be loaded. Check your connection, then reload the page.
          </p>
        ) : (
          <ProgressTable lectures={lectures.data} isTeacher={isTeacher} />
        )}
      </div>
    </main>
  );
}

function TeacherPicker({ teachers, value }: { teachers: readonly { teacher_user_id: string; display_name?: string | null }[]; value: string | null }) {
  const navigate = useNavigate({ from: "/progress" });
  return (
    <Select
      value={value}
      onChange={(k) => {
        if (k !== null) void navigate({ search: { teacher: String(k) } });
      }}
      className="mt-6 flex w-fit flex-col gap-1"
      placeholder="Choose a teacher"
    >
      <Label className="t-small font-semibold">Teacher</Label>
      <Button className="t-ui flex min-w-64 items-center justify-between gap-4 rounded-[3px] border border-slate bg-sheet px-3 py-1.5 text-left">
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover className="min-w-64 border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
        <ListBox className="t-ui outline-none">
          {teachers.map((t) => (
            <ListBoxItem key={t.teacher_user_id} id={t.teacher_user_id} className="cursor-pointer px-3 py-1.5 outline-none data-[focused]:bg-pen-tint data-[selected]:font-semibold">
              {t.display_name ?? "Unnamed teacher"}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

function ProgressTable({ lectures, isTeacher }: { lectures: Parameters<typeof buildProgress>[0]; isTeacher: boolean }) {
  const { rows, notes } = buildProgress(lectures);
  const notDone = lectures.length - rows.length;
  if (rows.length === 0) {
    return (
      <p className="t-reading py-4">
        {isTeacher ? "None of your lectures has been analysed yet." : "None of this teacher's lectures has been analysed yet."}
        {notDone > 0 ? ` ${notDone.toString()} ${notDone === 1 ? "is" : "are"} still processing or failed.` : ""}
        {isTeacher ? (
          <>
            {" "}
            <Link to="/lectures/new" className="action">
              Upload a lecture
            </Link>
          </>
        ) : null}
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto" role="region" aria-label="Measures by lecture" tabIndex={0}>
        <table className="t-ui w-full border-collapse">
          <caption className="sr-only">Measures by lecture, oldest first</caption>
          <thead>
            <tr>
              <th scope="col" className="t-small min-w-44 pr-5 pb-2 text-left align-bottom font-semibold text-slate">
                Lecture
              </th>
              {PROGRESS_METRICS.map((m) => (
                <th key={m} scope="col" className="t-small min-w-24 pr-5 pb-2 text-right align-bottom font-semibold text-slate">
                  {metricLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lecture: l, cells }) => (
              <tr key={l.lecture_id} className="border-t border-slate/25">
                <th scope="row" className="py-2 pr-5 text-left align-top font-normal">
                  <Link to="/lectures/$lectureId" params={{ lectureId: l.lecture_id }} className="action font-semibold">
                    {lectureTitle(l.metadata)}
                  </Link>
                  <span className="t-small nums block text-slate">{shortDate.format(new Date(l.created_at))}</span>
                </th>
                {PROGRESS_METRICS.map((m) => (
                  <td key={m} className="py-2 pr-5 text-right align-top" data-cell={m}>
                    <Cell cell={cells[m] ?? { kind: "not-computed" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.length > 0 ? (
        <section aria-labelledby="notes-h" className="mt-6">
          <h2 id="notes-h" className="t-ui m-0 font-semibold">
            Notes on the values
          </h2>
          <ol className="t-small measure mt-2 list-none space-y-1.5 p-0">
            {notes.map((n) => (
              <li key={n.n} id={`note-${n.n.toString()}`} className="grid grid-cols-[2rem_1fr] gap-x-2">
                <span className="nums font-semibold">{n.n}</span>
                <span>
                  {n.kind === "missing" ? <span className="font-semibold">N/A: </span> : <StatusMark kind="low-confidence" />} {n.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {notDone > 0 ? (
        <p className="t-small mt-4 text-slate">
          {notDone.toString()} {notDone === 1 ? "lecture isn't" : "lectures aren't"} shown because {notDone === 1 ? "it hasn't" : "they haven't"} finished processing.
        </p>
      ) : null}
      <details className="t-small measure mt-6">
        <summary className="action w-fit">What these measure</summary>
        <dl className="mt-3 space-y-3">
          {PROGRESS_METRICS.map((m) => (
            <div key={m}>
              <dt className="font-semibold">{metricLabel(m)}</dt>
              <dd className="m-0 text-slate">{METRIC_DEFINITIONS[m]?.definition ?? "No definition is recorded."}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}

function NoteRef({ n, children }: { n: number; children: ReactNode }) {
  return (
    <a href={`#note-${n.toString()}`} className="action t-small ml-1 align-super" aria-label={`${typeof children === "string" ? children : ""} note ${n.toString()}`}>
      {n}
    </a>
  );
}

function Cell({ cell }: { cell: ProgressCell }) {
  if (cell.kind === "not-computed") return <span className="t-small text-slate">Not computed</span>;
  if (cell.kind === "na")
    return (
      <span className="inline-flex items-baseline" data-metric-state="na">
        <span className="na-box nums">N/A</span>
        <NoteRef n={cell.note}>Missing,</NoteRef>
      </span>
    );
  if (cell.lowConfidence)
    return (
      <span className="inline-flex flex-col items-end" data-metric-state="low-confidence">
        <span>
          <span className="nums lowconf-value font-semibold">{cell.text}</span>
          <NoteRef n={cell.note}>Low confidence,</NoteRef>
        </span>
        <span className="t-small text-heather">Low confidence</span>
      </span>
    );
  return (
    <span className="nums font-semibold" data-metric-state="value">
      {cell.text}
    </span>
  );
}
