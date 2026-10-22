import { useState, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  RadioButton,
  RadioField,
  RadioGroup,
  Select,
  SelectValue,
  TextField,
} from "react-aria-components";
import type { Category } from "~/analysis/types.gen";
import { isApiError } from "~/api/client";
import { can } from "~/auth/roles";
import { CentreTrendChart, CentreTrendLegend } from "~/centre/CentreTrendChart";
import { orgSummaryQuery, orgTrendQuery } from "~/centre/queries";
import {
  GROUP_NOUN,
  countOf,
  filtersText,
  findingCell,
  inProgress,
  metricCell,
  parseBucket,
  parseFilters,
  parseGroupBy,
  parseRange,
  summaryRows,
  type Bucket,
  type CentreFilters,
  type GroupBy,
  type OrgSummary,
  type SummaryRange,
  type SummaryRow,
} from "~/centre/summary";
import {
  bucketName,
  bucketPoint,
  buildCentreTrend,
  type OrgTrend,
} from "~/centre/trend";
import { StatusMark } from "~/components/StatusMark";
import { CATEGORIES, NOT_YET_REPORTED } from "~/findings/categories";
import { longDate } from "~/lib/format";
import { METRIC_DEFINITIONS } from "~/metrics/definitions.gen";
import { metricLabel } from "~/metrics/labels";

type Search = SummaryRange &
  CentreFilters & { metric?: string; group?: GroupBy; bucket?: Bucket };

export const Route = createFileRoute("/_app/centre")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const group = parseGroupBy(s.group);
    const bucket = parseBucket(s.bucket);
    return {
      ...parseRange(s),
      ...parseFilters(s),
      ...(typeof s.metric === "string" && /^[a-z0-9_]+$/.test(s.metric)
        ? { metric: s.metric }
        : {}),
      ...(group !== "teacher" ? { group } : {}),
      ...(bucket !== "week" ? { bucket } : {}),
    };
  },
  beforeLoad: ({ context }) => {
    // Teachers can't open the centre summary (the API says 403); send them to their list.
    if (!can.seeCentreSummary(context.me.role))
      throw redirect({ to: "/lectures" });
  },
  component: Centre,
});

const DISPLAY_ORDER: readonly Category[] = [
  "strength",
  "content_error",
  "shortcoming",
  "conduct",
];

function Centre() {
  const search = Route.useSearch();
  const range: SummaryRange = {
    ...(search.from ? { from: search.from } : {}),
    ...(search.to ? { to: search.to } : {}),
  };
  const filters = parseFilters(search);
  const groupBy = search.group ?? "teacher";
  const bucket = search.bucket ?? "week";
  const q = useQuery(orgSummaryQuery(range, filters, groupBy));
  const trend = useQuery(orgTrendQuery(range, filters, bucket));
  // Filter choices: every subject and grade in the period, and every teacher (not narrowed).
  const subjects = useQuery(orgSummaryQuery(range, {}, "subject"));
  const grades = useQuery(orgSummaryQuery(range, {}, "grade"));
  const teacherName = filters.teacher
    ? (subjects.data?.teachers.find(
        (t) => t.teacher_user_id === filters.teacher,
      )?.display_name ?? null)
    : null;
  const subjectLabel = filters.subject
    ? (subjects.data?.groups.find((g) => g.key === filters.subject)?.label ??
      filters.subject)
    : undefined;
  const narrowed = filtersText(
    { ...filters, ...(subjectLabel ? { subject: subjectLabel } : {}) },
    teacherName,
  );
  return (
    <main className="pt-6">
      <h1 className="t-heading m-0">Centre summary</h1>
      <p className="t-reading measure mt-2 text-slate">
        Lecture counts, findings and measures for the centre, by teacher,
        subject or grade, in alphabetical or grade order. They describe lessons;
        they don't compare teachers. A measure depends on the class, the topic
        and the kind of lesson.
      </p>
      <PeriodFilter range={range} />
      <NarrowFilters
        filters={filters}
        subjects={subjects.data}
        grades={grades.data}
      />
      <GroupByControl value={groupBy} />
      <div className="mt-6 bg-sheet px-5 pt-2 pb-12 sm:px-8">
        {narrowed ? (
          <p className="t-small mt-4 mb-0 text-slate" data-filters-text>
            Only lectures matching:{" "}
            <span className="font-semibold text-ink">{narrowed}</span>.
          </p>
        ) : null}
        {q.isPending ? (
          <p className="t-reading py-8 text-slate">
            Loading the centre summary
          </p>
        ) : null}
        {q.isError ? (
          <p className="t-reading measure py-8" role="alert">
            {isApiError(q.error, "bad_range")
              ? "The start date is after the end date. Change one of them."
              : isApiError(q.error) && q.error.status === 403
                ? "Your role can't open the centre summary."
                : isApiError(q.error) && q.error.status === 404
                  ? "That teacher isn't in this centre. Choose another teacher."
                  : "The centre summary couldn't be loaded. Check your connection, then reload the page."}
          </p>
        ) : null}
        {q.data ? (
          <Summary
            s={q.data}
            metric={search.metric}
            trend={
              <OverTime
                q={trend}
                bucket={bucket}
                chosenDates={Boolean(range.from || range.to)}
              />
            }
          />
        ) : null}
      </div>
    </main>
  );
}

const selectButton =
  "t-ui flex min-w-44 items-center justify-between gap-4 rounded-[3px] border border-slate bg-sheet px-3 py-1.5 text-left";

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
      <Button className={selectButton}>
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      <Popover className="min-w-44 border border-slate/40 bg-sheet py-1 shadow-[0_6px_20px_rgb(23_32_30/0.12)]">
        <ListBox className="t-ui outline-none">
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

const ALL = "__all__";

function NarrowFilters({
  filters,
  subjects,
  grades,
}: {
  filters: CentreFilters;
  subjects: OrgSummary | undefined;
  grades: OrgSummary | undefined;
}) {
  const navigate = useNavigate({ from: "/centre" });
  const set = (key: keyof CentreFilters, v: string) => {
    void navigate({
      search: (prev) => ({ ...prev, [key]: v === ALL ? undefined : v }),
    });
  };
  // The current choice stays selectable even when the period has no lecture with it.
  const withCurrent = (
    opts: { id: string; label: string }[],
    current: string | undefined,
    label: (v: string) => string,
  ) =>
    current && !opts.some((o) => o.id === current)
      ? [...opts, { id: current, label: label(current) }]
      : opts;
  const subjectOpts = withCurrent(
    (subjects?.groups ?? []).flatMap((g) =>
      g.key === null ? [] : [{ id: g.key, label: g.label }],
    ),
    filters.subject,
    (v) => v,
  );
  const gradeOpts = withCurrent(
    (grades?.groups ?? []).flatMap((g) =>
      g.key === null ? [] : [{ id: g.key, label: `Grade ${g.label}` }],
    ),
    filters.grade,
    (v) => `Grade ${v}`,
  );
  const teacherOpts = withCurrent(
    (subjects?.teachers ?? []).map((t) => ({
      id: t.teacher_user_id,
      label: t.display_name ?? "Unnamed teacher",
    })),
    filters.teacher,
    () => "Chosen teacher",
  );
  return (
    <div
      className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3"
      role="group"
      aria-label="Which lectures"
    >
      <FilterSelect
        label="Subject"
        value={filters.subject ?? ALL}
        options={[{ id: ALL, label: "All subjects" }, ...subjectOpts]}
        onChange={(v) => {
          set("subject", v);
        }}
      />
      <FilterSelect
        label="Grade"
        value={filters.grade ?? ALL}
        options={[{ id: ALL, label: "All grades" }, ...gradeOpts]}
        onChange={(v) => {
          set("grade", v);
        }}
      />
      <FilterSelect
        label="Teacher"
        value={filters.teacher ?? ALL}
        options={[{ id: ALL, label: "All teachers" }, ...teacherOpts]}
        onChange={(v) => {
          set("teacher", v);
        }}
      />
    </div>
  );
}

const pill =
  "t-small inline-block cursor-pointer rounded-full border border-slate px-3 py-1 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet";

function GroupByControl({ value }: { value: GroupBy }) {
  const navigate = useNavigate({ from: "/centre" });
  return (
    <RadioGroup
      value={value}
      onChange={(v) => {
        const group = parseGroupBy(v);
        void navigate({
          search: (prev) => ({
            ...prev,
            group: group === "teacher" ? undefined : group,
          }),
          replace: true,
        });
      }}
      orientation="horizontal"
      className="mt-4 flex flex-wrap items-center gap-2"
    >
      <Label className="t-small mr-2 font-semibold">Group the tables by</Label>
      {(["teacher", "subject", "grade"] as const).map((g) => (
        <RadioField key={g} value={g}>
          <RadioButton className={pill}>{GROUP_NOUN[g]}</RadioButton>
        </RadioField>
      ))}
    </RadioGroup>
  );
}

function PeriodFilter({ range }: { range: SummaryRange }) {
  const navigate = useNavigate({ from: "/centre" });
  const [from, setFrom] = useState(range.from ?? "");
  const [to, setTo] = useState(range.to ?? "");
  const apply = (next: SummaryRange) => {
    void navigate({
      search: (prev) => ({
        ...(prev.metric ? { metric: prev.metric } : {}),
        ...(next.from ? { from: next.from } : {}),
        ...(next.to ? { to: next.to } : {}),
      }),
    });
  };
  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3"
      aria-label="Period"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ from, to });
      }}
    >
      <DateField label="Uploaded from" value={from} onChange={setFrom} />
      <DateField label="to" value={to} onChange={setTo} />
      <Button type="submit" className="button">
        Show this period
      </Button>
      {range.from || range.to ? (
        <Button
          className="action t-small pb-2"
          onPress={() => {
            setFrom("");
            setTo("");
            apply({});
          }}
        >
          Show all lectures
        </Button>
      ) : null}
      <p className="t-small m-0 basis-full text-slate">
        {range.from || range.to
          ? `Lectures uploaded ${range.from ? `from ${longDate(range.from)}` : ""}${range.from && range.to ? " " : ""}${range.to ? `up to ${longDate(range.to)}` : ""} (both days included).`
          : "Every lecture uploaded so far."}
      </p>
    </form>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      className="flex flex-col gap-1"
    >
      <Label className="t-small font-semibold">{label}</Label>
      <Input
        type="date"
        className="t-ui nums rounded-[3px] border border-slate bg-sheet px-2 py-1.5"
      />
    </TextField>
  );
}

type Row = SummaryRow & { name: ReactNode; isOrg: boolean };

function Summary({
  s,
  metric,
  trend,
}: {
  s: OrgSummary;
  metric: string | undefined;
  trend: ReactNode;
}) {
  const noun = GROUP_NOUN[s.group_by];
  const by = noun.toLowerCase();
  const groups: Row[] = summaryRows(s).map((r) => ({
    ...r,
    isOrg: r.kind === "org",
    name:
      r.kind === "teacher" ? (
        <TeacherName id={r.teacherId} name={r.label} active={r.active} />
      ) : r.kind === "org" ? (
        r.label
      ) : (
        <span className="font-semibold">{r.label}</span>
      ),
  }));
  return (
    <>
      <Section title="Lectures" id="lectures">
        <Table caption={`Lectures by ${by}`}>
          <thead>
            <tr>
              <Th>{noun}</Th>
              <Th num>Lectures</Th>
              <Th num>Analysed</Th>
              <Th num>In progress</Th>
              <Th num>Failed</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, name, g, isOrg }) => (
              <tr key={key} className={rowClass(isOrg)}>
                <th
                  scope="row"
                  className="py-2 pr-6 text-left align-top font-normal"
                >
                  {name}
                </th>
                <Td num>{g.n_lectures}</Td>
                <Td num>{g.lectures_by_status.done ?? 0}</Td>
                <Td num>{inProgress(g)}</Td>
                <Td num>{g.lectures_by_status.failed ?? 0}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {s.group_by === "teacher" && s.teachers.length === 0 ? (
          <p className="t-reading mt-4">
            There are no teachers in the centre yet. An admin can add them under
            Users.
          </p>
        ) : null}
      </Section>

      <Section title="Findings" id="findings">
        <p className="t-small measure mt-1 text-slate">
          Findings in analysed lectures. A category counts only lectures that
          were checked for it. Teaching-practice findings aren't faults: they're
          points a teacher may want to look at.
        </p>
        {s.org.n_done_categories_unknown > 0 ? (
          <p className="t-small measure mt-1 text-slate">
            {countOf(s.org.n_done_categories_unknown, "analysed lecture")}{" "}
            {s.org.n_done_categories_unknown === 1 ? "has" : "have"} no record
            of which categories were checked, so{" "}
            {s.org.n_done_categories_unknown === 1 ? "it's" : "they're"} left
            out of these counts.
          </p>
        ) : null}
        <Table caption={`Findings by ${by}`}>
          <thead>
            <tr>
              <Th>{noun}</Th>
              {DISPLAY_ORDER.map((c) => (
                <Th key={c}>{CATEGORIES[c].label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, name, g, isOrg }) => (
              <tr key={key} className={rowClass(isOrg)}>
                <th
                  scope="row"
                  className="py-2 pr-6 text-left align-top font-normal"
                >
                  {name}
                </th>
                {DISPLAY_ORDER.map((c) => (
                  <td key={c} className="t-small py-2 pr-6 align-top">
                    <FindingCellView
                      cell={findingCell(
                        g,
                        c,
                        s.released_categories,
                        CATEGORIES[c].group === "worked",
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      {trend}

      <Measures s={s} groups={groups} metric={metric} />
    </>
  );
}

function FindingCellView({ cell }: { cell: ReturnType<typeof findingCell> }) {
  if (cell.kind === "not-released")
    return <span className="text-slate">{NOT_YET_REPORTED}</span>;
  if (cell.kind === "not-checked")
    return <span className="text-slate">Not checked in any lecture yet</span>;
  return (
    <span>
      <span className="nums font-semibold">{cell.n}</span>{" "}
      <span className="text-slate">in {countOf(cell.lectures, "lecture")}</span>
      {cell.bySeverity ? (
        <span className="block text-slate">{cell.bySeverity}</span>
      ) : null}
    </span>
  );
}

function Measures({
  s,
  groups,
  metric,
}: {
  s: OrgSummary;
  groups: Row[];
  metric: string | undefined;
}) {
  const noun = GROUP_NOUN[s.group_by];
  const navigate = useNavigate({ from: "/centre" });
  const names = s.metric_names;
  const current = metric && names.includes(metric) ? metric : names[0];
  if (!current) return null;
  const def = METRIC_DEFINITIONS[current];
  return (
    <Section title="Measures" id="measures">
      <p className="t-small measure mt-1 text-slate">
        For each {noun.toLowerCase()}&apos;s analysed lectures: the middle value
        (median) and the middle half of the values. Lectures where a measure is
        missing are counted, never treated as zero.
      </p>
      <RadioGroup
        value={current}
        onChange={(v) => {
          void navigate({
            search: (prev) => ({ ...prev, metric: v }),
            replace: true,
          });
        }}
        className="mt-4"
        aria-label="Measure"
        orientation="horizontal"
      >
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <RadioField key={n} value={n}>
              <RadioButton className={pill}>{metricLabel(n)}</RadioButton>
            </RadioField>
          ))}
        </div>
      </RadioGroup>
      {def ? (
        <p className="t-small measure mt-3 mb-0">{def.definition}</p>
      ) : null}
      <Table caption={`${metricLabel(current)} by ${noun.toLowerCase()}`}>
        <thead>
          <tr>
            <Th>{noun}</Th>
            <Th num>Lectures with a value</Th>
            <Th num>Median</Th>
            <Th num>Middle half</Th>
            <Th>Low confidence</Th>
            <Th>Missing</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ key, name, g, isOrg }) => {
            const agg = g.metrics[current];
            const cell = metricCell(agg, g.lectures_by_status.done ?? 0);
            return (
              <tr key={key} className={rowClass(isOrg)} data-metric-row={key}>
                <th
                  scope="row"
                  className="py-2 pr-6 text-left align-top font-normal"
                >
                  {name}
                </th>
                <Td num>{agg?.n_lectures_with_value ?? 0}</Td>
                {cell.kind === "value" ? (
                  <>
                    <Td num>{cell.median}</Td>
                    <Td num>
                      {cell.range ?? (
                        <span className="text-slate">One value only</span>
                      )}
                    </Td>
                  </>
                ) : (
                  <td
                    colSpan={2}
                    className="t-small py-2 pr-6 align-top"
                    data-metric-state="na"
                  >
                    <span className="na-box">N/A</span>{" "}
                    <span>{cell.reason}</span>
                  </td>
                )}
                <td className="t-small py-2 pr-6 align-top">
                  {agg && agg.n_low_confidence > 0 ? (
                    <StatusMark kind="low-confidence">
                      {agg.n_low_confidence.toString()} of{" "}
                      {agg.n_lectures_with_value.toString()} low confidence
                    </StatusMark>
                  ) : (
                    <span className="text-slate">None</span>
                  )}
                </td>
                <td className="t-small py-2 pr-6 align-top">
                  {agg && agg.n_null > 0 ? (
                    <span>
                      <span className="nums font-semibold">
                        {countOf(agg.n_null, "lecture")}
                      </span>
                      {agg.most_common_null_reason ? (
                        <span className="block text-slate">
                          Most often: {agg.most_common_null_reason}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate">None</span>
                  )}
                  {agg && agg.n_not_computed > 0 ? (
                    <span className="block text-slate">
                      Not computed yet: {countOf(agg.n_not_computed, "lecture")}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="t-small measure mt-3 text-slate">
        Low-confidence values are included in the median and middle half;
        missing ones are not.
      </p>
    </Section>
  );
}

function OverTime({
  q,
  bucket,
  chosenDates,
}: {
  q: UseQueryResult<OrgTrend>;
  bucket: Bucket;
  chosenDates: boolean;
}) {
  const navigate = useNavigate({ from: "/centre" });
  const unit = bucket === "week" ? "week" : "month";
  return (
    <Section title="Measures over time" id="over-time">
      <p className="t-small measure mt-1 text-slate">
        For each {unit}, the median of the centre&apos;s analysed lectures
        uploaded that {unit}, with the middle half shaded. Every {unit} stands
        on its own: nothing is averaged across {unit}s and nothing is predicted.
        A {unit} with only one or two lectures is marked n=1 or n=2; read it as
        one or two lessons, not as the centre.
      </p>
      <RadioGroup
        value={bucket}
        onChange={(v) => {
          const b = parseBucket(v);
          void navigate({
            search: (prev) => ({
              ...prev,
              bucket: b === "week" ? undefined : b,
            }),
            replace: true,
          });
        }}
        orientation="horizontal"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <Label className="t-small mr-2 font-semibold">One point per</Label>
        <RadioField value="week">
          <RadioButton className={pill}>Week</RadioButton>
        </RadioField>
        <RadioField value="month">
          <RadioButton className={pill}>Month</RadioButton>
        </RadioField>
      </RadioGroup>
      {q.isPending ? (
        <p className="t-reading py-4 text-slate">
          Loading the measures over time
        </p>
      ) : null}
      {q.isError ? (
        <p className="t-reading measure py-4" role="alert">
          {isApiError(q.error, "too_many_buckets")
            ? "That period is too long to show week by week. Choose months, or a shorter period."
            : "The measures over time couldn't be loaded. Reload the page to try again."}
        </p>
      ) : null}
      {/* "Part of it" only means something when the viewer chose the dates. */}
      {q.data ? (
        <OverTimeCharts
          t={
            chosenDates
              ? q.data
              : {
                  ...q.data,
                  buckets: q.data.buckets.map((b) => ({
                    ...b,
                    partial: false,
                  })),
                }
          }
        />
      ) : null}
    </Section>
  );
}

function OverTimeCharts({ t }: { t: OrgTrend }) {
  if (t.buckets.length === 0)
    return (
      <p className="t-reading py-4">No lectures match these choices yet.</p>
    );
  return (
    <>
      <p className="t-small mt-3 mb-0 text-slate">
        By upload date (UTC),{" "}
        {longDate(t.from_date ?? t.buckets[0]?.start ?? "")} to{" "}
        {longDate(t.to_date ?? t.buckets[t.buckets.length - 1]?.end ?? "")}.
      </p>
      <CentreTrendLegend />
      <div className="mt-4 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        {t.metric_names.map((m) => (
          <CentreTrendChart key={m} trend={buildCentreTrend(t, m)} />
        ))}
      </div>
      <h3 className="t-ui mt-8 mb-0 font-semibold">
        Exact values, {t.bucket === "week" ? "week by week" : "month by month"}
      </h3>
      <p className="t-small mt-1 text-slate">
        Median, then the middle half and how many lectures have a value. N/A
        means the {t.bucket} had lectures but no value.
      </p>
      <Table
        caption={`Measures ${t.bucket === "week" ? "week by week" : "month by month"}, oldest first`}
      >
        <thead>
          <tr>
            <Th>{t.bucket === "week" ? "Week" : "Month"}</Th>
            <Th num>Lectures</Th>
            {t.metric_names.map((m) => (
              <Th key={m} num>
                {metricLabel(m)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.buckets.map((b) => (
            <tr
              key={b.start}
              className="border-t border-slate/25"
              data-bucket-row={b.start}
            >
              <th
                scope="row"
                className="t-small min-w-32 py-2 pr-6 text-left align-top font-normal"
              >
                {bucketName(
                  { start: b.start, end: b.end, partial: b.partial },
                  t.bucket,
                )}
              </th>
              <Td num>{b.n_lectures}</Td>
              {t.metric_names.map((m) => {
                const p = bucketPoint(b, m, 0);
                return (
                  <td
                    key={m}
                    className="t-small min-w-28 py-2 pr-6 text-right align-top"
                    data-cell={m}
                  >
                    {p.state === "no-lectures" ? (
                      <span className="text-slate">No lectures</span>
                    ) : p.state === "na" ? (
                      <span>
                        <span className="na-box">N/A</span>
                        <span className="block text-left text-slate">
                          {p.reason}
                        </span>
                      </span>
                    ) : (
                      <span>
                        <span className="nums block font-semibold text-ink">
                          {p.medianText}
                        </span>
                        {p.rangeText ? (
                          <span className="nums block text-slate">
                            {p.rangeText}
                          </span>
                        ) : null}
                        <span
                          className={`nums block ${p.few ? "font-semibold text-ink" : "text-slate"}`}
                        >
                          n={p.n}
                        </span>
                        {p.lowConfidence > 0 ? (
                          <StatusMark kind="low-confidence">
                            {p.lowConfidence.toString()} low confidence
                          </StatusMark>
                        ) : null}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

function TeacherName({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  return (
    <span>
      <span className="font-semibold">{name}</span>
      {active ? null : (
        <span className="t-small text-slate"> (deactivated)</span>
      )}
      <span className="t-small flex flex-wrap gap-x-3">
        <Link to="/lectures" search={{ teacher: id }} className="action">
          Their lectures
        </Link>
        <Link to="/progress" search={{ teacher: id }} className="action">
          Measures over time
        </Link>
      </span>
    </span>
  );
}

function rowClass(isOrg: boolean): string {
  return `border-t border-slate/25 ${isOrg ? "border-b-2 border-b-slate/50" : ""}`;
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`h-${id}`} className="pt-8">
      <h2 id={`h-${id}`} className="t-subheading m-0">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Wide tables scroll sideways inside their own focusable region instead of the page. */
function Table({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mt-4 overflow-x-auto"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="t-ui w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function Th({ children, num = false }: { children: ReactNode; num?: boolean }) {
  return (
    <th
      scope="col"
      className={`t-small pr-6 pb-2 align-bottom font-semibold text-slate ${num ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, num = false }: { children: ReactNode; num?: boolean }) {
  return (
    <td className={`py-2 pr-6 align-top ${num ? "nums text-right" : ""}`}>
      {children}
    </td>
  );
}
