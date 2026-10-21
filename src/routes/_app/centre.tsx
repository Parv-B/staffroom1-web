import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button, Input, Label, RadioButton, RadioField, RadioGroup, TextField } from "react-aria-components";
import type { Category } from "~/analysis/types.gen";
import { isApiError } from "~/api/client";
import { can } from "~/auth/roles";
import { orgSummaryQuery } from "~/centre/queries";
import { countOf, findingCell, inProgress, metricCell, parseRange, type GroupSummary, type OrgSummary, type SummaryRange } from "~/centre/summary";
import { StatusMark } from "~/components/StatusMark";
import { CATEGORIES, NOT_YET_REPORTED } from "~/findings/categories";
import { longDate } from "~/lib/format";
import { METRIC_DEFINITIONS } from "~/metrics/definitions.gen";
import { metricLabel } from "~/metrics/labels";

type Search = SummaryRange & { metric?: string };

export const Route = createFileRoute("/_app/centre")({
  validateSearch: (s: Record<string, unknown>): Search => ({ ...parseRange(s), ...(typeof s.metric === "string" && /^[a-z0-9_]+$/.test(s.metric) ? { metric: s.metric } : {}) }),
  beforeLoad: ({ context }) => {
    // Teachers can't open the centre summary (the API says 403); send them to their list.
    if (!can.seeCentreSummary(context.me.role)) throw redirect({ to: "/lectures" });
  },
  component: Centre,
});

const DISPLAY_ORDER: readonly Category[] = ["strength", "pedagogy", "content_error", "explanation_gap", "conduct"];

function Centre() {
  const search = Route.useSearch();
  const range: SummaryRange = { ...(search.from ? { from: search.from } : {}), ...(search.to ? { to: search.to } : {}) };
  const q = useQuery(orgSummaryQuery(range));
  return (
    <main className="pt-6">
      <h1 className="t-heading m-0">Centre summary</h1>
      <p className="t-reading measure mt-2 text-slate">
        Lecture counts, findings and measures for each teacher, in alphabetical order. They describe lessons; they don't compare teachers. A measure depends on the
        class, the topic and the kind of lesson.
      </p>
      <PeriodFilter range={range} />
      <div className="mt-6 bg-sheet px-5 pt-2 pb-12 sm:px-8">
        {q.isPending ? <p className="t-reading py-8 text-slate">Loading the centre summary</p> : null}
        {q.isError ? (
          <p className="t-reading measure py-8" role="alert">
            {isApiError(q.error, "bad_range")
              ? "The start date is after the end date. Change one of them."
              : isApiError(q.error) && q.error.status === 403
                ? "Your role can't open the centre summary."
                : "The centre summary couldn't be loaded. Check your connection, then reload the page."}
          </p>
        ) : null}
        {q.data ? <Summary s={q.data} metric={search.metric} /> : null}
      </div>
    </main>
  );
}

function PeriodFilter({ range }: { range: SummaryRange }) {
  const navigate = useNavigate({ from: "/centre" });
  const [from, setFrom] = useState(range.from ?? "");
  const [to, setTo] = useState(range.to ?? "");
  const apply = (next: SummaryRange) => {
    void navigate({ search: (prev) => ({ ...(prev.metric ? { metric: prev.metric } : {}), ...(next.from ? { from: next.from } : {}), ...(next.to ? { to: next.to } : {}) }) });
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

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <TextField value={value} onChange={onChange} className="flex flex-col gap-1">
      <Label className="t-small font-semibold">{label}</Label>
      <Input type="date" className="t-ui nums rounded-[3px] border border-slate bg-sheet px-2 py-1.5" />
    </TextField>
  );
}

function Summary({ s, metric }: { s: OrgSummary; metric: string | undefined }) {
  const groups: { key: string; name: ReactNode; g: GroupSummary; isOrg: boolean }[] = [
    { key: "org", name: "Whole centre", g: s.org, isOrg: true },
    ...s.teachers.map((t) => ({
      key: t.teacher_user_id,
      name: <TeacherName id={t.teacher_user_id} name={t.display_name ?? "Unnamed teacher"} active={t.active} />,
      g: t,
      isOrg: false,
    })),
  ];
  return (
    <>
      <Section title="Lectures" id="lectures">
        <Table caption="Lectures by teacher">
          <thead>
            <tr>
              <Th>Teacher</Th>
              <Th num>Lectures</Th>
              <Th num>Analysed</Th>
              <Th num>In progress</Th>
              <Th num>Failed</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, name, g, isOrg }) => (
              <tr key={key} className={rowClass(isOrg)}>
                <th scope="row" className="py-2 pr-6 text-left align-top font-normal">
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
        {s.teachers.length === 0 ? <p className="t-reading mt-4">There are no teachers in the centre yet. An admin can add them under Users.</p> : null}
      </Section>

      <Section title="Findings" id="findings">
        <p className="t-small measure mt-1 text-slate">
          Findings in analysed lectures. A category counts only lectures that were checked for it. Teaching-practice findings aren't faults: they're points a
          teacher may want to look at.
        </p>
        {s.org.n_done_categories_unknown > 0 ? (
          <p className="t-small measure mt-1 text-slate">
            {countOf(s.org.n_done_categories_unknown, "analysed lecture")} {s.org.n_done_categories_unknown === 1 ? "has" : "have"} no record of which
            categories were checked, so {s.org.n_done_categories_unknown === 1 ? "it's" : "they're"} left out of these counts.
          </p>
        ) : null}
        <Table caption="Findings by teacher">
          <thead>
            <tr>
              <Th>Teacher</Th>
              {DISPLAY_ORDER.map((c) => (
                <Th key={c}>{CATEGORIES[c].label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, name, g, isOrg }) => (
              <tr key={key} className={rowClass(isOrg)}>
                <th scope="row" className="py-2 pr-6 text-left align-top font-normal">
                  {name}
                </th>
                {DISPLAY_ORDER.map((c) => (
                  <td key={c} className="t-small py-2 pr-6 align-top">
                    <FindingCellView cell={findingCell(g, c, s.released_categories, CATEGORIES[c].group === "worked")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Measures s={s} groups={groups} metric={metric} />
    </>
  );
}

function FindingCellView({ cell }: { cell: ReturnType<typeof findingCell> }) {
  if (cell.kind === "not-released") return <span className="text-slate">{NOT_YET_REPORTED}</span>;
  if (cell.kind === "not-checked") return <span className="text-slate">Not checked in any lecture yet</span>;
  return (
    <span>
      <span className="nums font-semibold">{cell.n}</span> <span className="text-slate">in {countOf(cell.lectures, "lecture")}</span>
      {cell.bySeverity ? <span className="block text-slate">{cell.bySeverity}</span> : null}
    </span>
  );
}

function Measures({ s, groups, metric }: { s: OrgSummary; groups: { key: string; name: ReactNode; g: GroupSummary; isOrg: boolean }[]; metric: string | undefined }) {
  const navigate = useNavigate({ from: "/centre" });
  const names = s.metric_names;
  const current = metric && names.includes(metric) ? metric : names[0];
  if (!current) return null;
  const def = METRIC_DEFINITIONS[current];
  return (
    <Section title="Measures" id="measures">
      <p className="t-small measure mt-1 text-slate">
        For each teacher's analysed lectures: the middle value (median) and the middle half of the values. Lectures where a measure is missing are counted, never
        treated as zero.
      </p>
      <RadioGroup
        value={current}
        onChange={(v) => {
          void navigate({ search: (prev) => ({ ...prev, metric: v }), replace: true });
        }}
        className="mt-4"
        aria-label="Measure"
        orientation="horizontal"
      >
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <RadioField key={n} value={n}>
            <RadioButton
              className="t-small inline-block cursor-pointer rounded-full border border-slate px-3 py-1 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-pen data-[selected]:border-pen data-[selected]:bg-pen data-[selected]:text-sheet"
            >
              {metricLabel(n)}
            </RadioButton>
            </RadioField>
          ))}
        </div>
      </RadioGroup>
      {def ? <p className="t-small measure mt-3 mb-0">{def.definition}</p> : null}
      <Table caption={`${metricLabel(current)} by teacher`}>
        <thead>
          <tr>
            <Th>Teacher</Th>
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
                <th scope="row" className="py-2 pr-6 text-left align-top font-normal">
                  {name}
                </th>
                <Td num>{agg?.n_lectures_with_value ?? 0}</Td>
                {cell.kind === "value" ? (
                  <>
                    <Td num>{cell.median}</Td>
                    <Td num>{cell.range ?? <span className="text-slate">One value only</span>}</Td>
                  </>
                ) : (
                  <td colSpan={2} className="t-small py-2 pr-6 align-top" data-metric-state="na">
                    <span className="na-box">N/A</span> <span>{cell.reason}</span>
                  </td>
                )}
                <td className="t-small py-2 pr-6 align-top">
                  {agg && agg.n_low_confidence > 0 ? (
                    <StatusMark kind="low-confidence">
                      {agg.n_low_confidence.toString()} of {agg.n_lectures_with_value.toString()} low confidence
                    </StatusMark>
                  ) : (
                    <span className="text-slate">None</span>
                  )}
                </td>
                <td className="t-small py-2 pr-6 align-top">
                  {agg && agg.n_null > 0 ? (
                    <span>
                      <span className="nums font-semibold">{countOf(agg.n_null, "lecture")}</span>
                      {agg.most_common_null_reason ? <span className="block text-slate">Most often: {agg.most_common_null_reason}</span> : null}
                    </span>
                  ) : (
                    <span className="text-slate">None</span>
                  )}
                  {agg && agg.n_not_computed > 0 ? <span className="block text-slate">Not computed yet: {countOf(agg.n_not_computed, "lecture")}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="t-small measure mt-3 text-slate">Low-confidence values are included in the median and middle half; missing ones are not.</p>
    </Section>
  );
}

function TeacherName({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <span>
      <span className="font-semibold">{name}</span>
      {active ? null : <span className="t-small text-slate"> (deactivated)</span>}
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

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
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
function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="t-ui w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function Th({ children, num = false }: { children: ReactNode; num?: boolean }) {
  return (
    <th scope="col" className={`t-small pr-6 pb-2 align-bottom font-semibold text-slate ${num ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, num = false }: { children: ReactNode; num?: boolean }) {
  return <td className={`py-2 pr-6 align-top ${num ? "nums text-right" : ""}`}>{children}</td>;
}
