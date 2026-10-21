import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import type { Category } from "~/analysis/types.gen";
import type { Schemas } from "~/api/client";
import { can } from "~/auth/roles";
import type { Role } from "~/auth/session";
import { orgSummaryQuery } from "~/centre/queries";
import { FindingCounts } from "~/components/FindingCounts";
import { MetricValue } from "~/components/MetricValue";
import { StatusMark } from "~/components/StatusMark";
import { PAGE_SIZE, lectureListQuery, type LectureListFilters } from "~/lectures/queries";
import { STATUS_LABEL, STATUS_ORDER, lectureFacts, lectureTitle, type LectureStatus, type LectureSummary } from "~/lectures/vocab";
import { longDate } from "~/lib/format";
import { metricLabel } from "~/metrics/labels";
import { fromBrief } from "~/metrics/reading";

// The four measures shown per lecture in the list; every one is in /org/summary too.
const KEY_METRICS = ["student_talk_share", "teacher_question_count", "wait_time_median_s", "teacher_wpm"] as const;

function isStatus(v: unknown): v is LectureStatus {
  return typeof v === "string" && (STATUS_ORDER as readonly string[]).includes(v);
}

export const Route = createFileRoute("/_app/lectures/")({
  validateSearch: (s: Record<string, unknown>): LectureListFilters => ({
    ...(isStatus(s.status) ? { status: s.status } : {}),
    ...(typeof s.teacher === "string" && s.teacher ? { teacher: s.teacher } : {}),
    ...(typeof s.page === "number" && Number.isInteger(s.page) && s.page > 1 ? { page: s.page } : {}),
  }),
  component: LectureList,
});

function LectureList() {
  const { me } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useQuery(lectureListQuery(filters));
  const org = useQuery({ ...orgSummaryQuery(), enabled: can.seeCentreSummary(me.role) });

  // Which categories were reported depends on when each lecture was published, and the list
  // doesn't say (FRONTEND_REQUESTS.md #2). The centre's current setting isn't a substitute: a
  // lecture published before a category was released was never checked for it. So the list
  // claims nothing about categories without findings.
  const released: readonly Category[] | null = null;
  const teacherNames = new Map((org.data?.teachers ?? []).map((t) => [t.teacher_user_id, t.display_name ?? "Unnamed teacher"]));
  const showTeacher = can.filterByTeacher(me.role);

  const setFilter = (patch: Partial<LectureListFilters>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });
  };

  return (
    <main className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="t-heading">{me.role === "teacher" ? "Your lectures" : "Lectures"}</h1>
        {can.upload(me.role) ? (
          <Link to="/lectures/new" className="button no-underline" data-variant="primary">
            Upload a lecture
          </Link>
        ) : null}
      </div>
      <p className="t-reading measure mt-2 text-slate">
        {me.role === "teacher"
          ? "Each analysis is private to you unless you share it with the centre owner."
          : me.role === "owner"
            ? "Every lecture in the centre. You can open a full analysis when its teacher has shared it."
            : "Every lecture in the centre."}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3" role="group" aria-label="Filters">
        <FilterSelect
          label="Status"
          value={filters.status ?? "all"}
          options={[{ id: "all", label: "All statuses" }, ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_LABEL[s] }))]}
          onChange={(v) => {
            setFilter({ status: isStatus(v) ? v : undefined });
          }}
        />
        {showTeacher ? (
          <FilterSelect
            label="Teacher"
            value={filters.teacher ?? "all"}
            options={[
              { id: "all", label: "All teachers" },
              ...(org.data?.teachers ?? []).map((t) => ({ id: t.teacher_user_id, label: t.display_name ?? "Unnamed teacher" })),
            ]}
            onChange={(v) => {
              setFilter({ teacher: v === "all" ? undefined : v });
            }}
          />
        ) : null}
      </div>

      <section className="mt-6 bg-sheet px-5 sm:px-8" aria-label="Lectures" aria-busy={list.isPending}>
        {list.isPending ? <p className="t-reading py-8 text-slate">Loading lectures</p> : null}
        {list.isError ? (
          <p className="t-reading py-8" role="alert">
            The lectures couldn't be loaded. Check your connection, then reload the page.
          </p>
        ) : null}
        {list.data && list.data.items.length === 0 ? <EmptyState role={me.role} filtered={Boolean(filters.status ?? filters.teacher)} /> : null}
        {list.data && list.data.items.length > 0 ? (
          <ol className="m-0 list-none p-0">
            {list.data.items.map((l) => (
              <LectureRow
                key={l.lecture_id}
                lecture={l}
                role={me.role}
                released={released}
                teacherName={showTeacher ? (teacherNames.get(l.teacher_user_id) ?? "Teacher not listed") : null}
              />
            ))}
          </ol>
        ) : null}
      </section>
      {list.data ? <Pager total={list.data.total} page={filters.page ?? 1} /> : null}
    </main>
  );
}

function LectureRow({
  lecture: l,
  role,
  released,
  teacherName,
}: {
  lecture: LectureSummary;
  role: Role;
  released: readonly Category[] | null;
  teacherName: string | null;
}) {
  const title = lectureTitle(l.metadata);
  const done = l.status === "done";
  return (
    <li className="grid gap-x-8 gap-y-4 border-b border-slate/25 py-6 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_15rem_22rem]">
      <div>
        <h2 className="t-subheading m-0">
          <Link to="/lectures/$lectureId" params={{ lectureId: l.lecture_id }} className="text-ink underline decoration-slate/40 underline-offset-4 hover:decoration-pen">
            {title}
          </Link>
        </h2>
        <p className="t-small mt-1 text-slate">
          {teacherName ? <>{teacherName}. </> : null}
          {lectureFacts(l.metadata, l.duration_ms)}. Uploaded {longDate(l.created_at)}.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`t-small font-semibold ${l.status === "failed" ? "text-ink" : "text-slate"}`}>{STATUS_LABEL[l.status]}</span>
          <SharingMark shared={l.shared_with_owner} role={role} />
        </p>
      </div>

      <div>
        <h3 className="t-small m-0 font-semibold text-slate">Findings</h3>
        <div className="mt-1">
          {done ? (
            <FindingCounts counts={l.findings_summary} released={released} />
          ) : (
            <p className="t-small m-0 text-slate">Findings appear when processing finishes.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="t-small m-0 font-semibold text-slate">Key measures</h3>
        <KeyMetrics lecture={l} />
      </div>
    </li>
  );
}

function SharingMark({ shared, role }: { shared: boolean; role: Role }) {
  if (role === "teacher") {
    return <span className="t-small text-slate">{shared ? "Shared with the centre owner" : "Private to you"}</span>;
  }
  return shared ? <span className="t-small text-slate">Shared by the teacher</span> : <StatusMark kind="not-shared" />;
}

function KeyMetrics({ lecture: l }: { lecture: LectureSummary }) {
  if (l.status !== "done") return <p className="t-small mt-1 text-slate">Measures appear when processing finishes.</p>;
  const summary = l.metrics_summary;
  if (!summary) return <p className="t-small mt-1 text-slate">No measures were stored for this lecture.</p>;
  return (
    <dl className="mt-1 space-y-1.5">
      {KEY_METRICS.map((name) => {
        const brief: Schemas["MetricBrief"] | undefined = summary[name];
        return (
          <div key={name} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3">
            <dt className="t-small text-slate">{metricLabel(name)}</dt>
            <dd className="m-0">
              {brief ? (
                <MetricValue reading={fromBrief(name, brief)} layout="stacked" />
              ) : (
                <MetricValue
                  layout="stacked"
                  reading={{ name, value: null, unit: "", lowConfidence: false, nullReason: "Not computed for this lecture.", lowConfidenceReason: null }}
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function EmptyState({ role, filtered }: { role: Role; filtered: boolean }) {
  return (
    <div className="py-10">
      <p className="t-reading measure m-0">
        {filtered
          ? "No lectures match these filters. Change or clear them to see more."
          : role === "teacher"
            ? "You haven't uploaded a lecture yet. Upload a recording of a class to get its analysis."
            : role === "admin"
              ? "No lectures have been uploaded in this centre yet. You can upload one on a teacher's behalf."
              : "No lectures have been uploaded in this centre yet."}
      </p>
    </div>
  );
}

function Pager({ total, page }: { total: number; page: number }) {
  if (total <= PAGE_SIZE) return <p className="t-small nums mt-3 text-slate">{total === 1 ? "1 lecture" : `${total.toString()} lectures`}</p>;
  const last = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <nav className="t-small nums mt-3 flex items-center gap-4" aria-label="Pages">
      <span className="text-slate">
        Lectures {from}–{to} of {total}
      </span>
      {page > 1 ? (
        <Link from={Route.fullPath} search={(p) => ({ ...p, page: page - 1 > 1 ? page - 1 : undefined })} className="action">
          Previous page
        </Link>
      ) : null}
      {page < last ? (
        <Link from={Route.fullPath} search={(p) => ({ ...p, page: page + 1 })} className="action">
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(k) => {
        if (k !== null) onChange(String(k));
      }}
      className="flex flex-col gap-1"
    >
      <Label className="t-small font-semibold">{label}</Label>
      <Button className="t-ui flex min-w-56 items-center justify-between gap-3 rounded-[3px] border border-slate bg-sheet px-3 py-2 text-left">
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover className="min-w-[--trigger-width] border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
        <ListBox className="t-ui max-h-80 overflow-auto outline-none">
          {options.map((o) => (
            <ListBoxItem
              key={o.id}
              id={o.id}
              className="cursor-pointer px-3 py-1.5 outline-none data-[focused]:bg-pen-tint data-[selected]:font-semibold"
            >
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
