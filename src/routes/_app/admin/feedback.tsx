import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import type { Category } from "~/analysis/types.gen";
import { api, unwrap, type Schemas } from "~/api/client";
import { can } from "~/auth/roles";
import { CATEGORIES, SEVERITY_LABEL } from "~/findings/categories";

export const Route = createFileRoute("/_app/admin/feedback")({
  beforeLoad: ({ context }) => {
    // Feedback is the teacher's private label: admins only (the API refuses owners too).
    if (!can.manageUsers(context.me.role)) throw redirect({ to: "/lectures" });
  },
  component: FeedbackSummary,
});

const feedbackSummaryQuery = queryOptions({
  queryKey: ["org", "feedback-summary"],
  queryFn: () => unwrap(api.GET("/org/feedback-summary", {})),
  staleTime: 60_000,
});

const ORDER: readonly Category[] = ["strength", "pedagogy", "content_error", "explanation_gap", "conduct"];
const SEVERITIES = ["important", "moderate", "minor", "info"] as const;
type Counts = Schemas["VerdictCounts"];

function FeedbackSummary() {
  const q = useQuery(feedbackSummaryQuery);
  return (
    <main className="pt-6">
      <h1 className="t-heading m-0">Responses to findings</h1>
      <p className="t-reading measure mt-2 text-slate">
        How teachers responded to the findings in their analyses, counted by category across the centre. Use it to judge whether a category's findings can be
        trusted. It's about the findings, not the teachers: there are no names, comments or per-lecture rows. With only one or two teachers, the counts are in
        effect theirs.
      </p>
      <div className="mt-6 bg-sheet px-5 pt-4 pb-10 sm:px-8">
        {q.isPending ? <p className="t-reading py-4 text-slate">Loading the responses</p> : null}
        {q.isError ? (
          <p className="t-reading py-4" role="alert">
            The responses couldn't be loaded. Check your connection, then reload the page.
          </p>
        ) : null}
        {q.data ? <Table s={q.data} /> : null}
      </div>
    </main>
  );
}

function Table({ s }: { s: Schemas["FeedbackSummaryOut"] }) {
  return (
    <>
      <p className="t-small m-0 text-slate">
        Across {s.n_lectures.toString()} {s.n_lectures === 1 ? "lecture" : "lectures"}. Each finding counts once per person who responded.
      </p>
      <div className="mt-4 overflow-x-auto" role="region" aria-label="Responses by category" tabIndex={0}>
        <table className="t-ui w-full border-collapse">
          <caption className="sr-only">Responses to findings by category</caption>
          <thead>
            <tr className="t-small text-slate">
              <th scope="col" className="pr-6 pb-2 text-left font-semibold">
                Category
              </th>
              {["Findings", "Agree", "Disagree", "Needs context", "No response yet"].map((h) => (
                <th key={h} scope="col" className="pr-6 pb-2 text-right font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDER.map((c) => {
              const f = s.categories[c];
              const released = s.released_categories.includes(c);
              return (
                <tr key={c} className="border-t border-slate/25 align-top" data-feedback-row={c}>
                  <th scope="row" className="py-2.5 pr-6 text-left font-normal">
                    <span className="font-semibold">{CATEGORIES[c].label}</span>
                    {!released ? <span className="t-small block text-slate">Not shown to teachers yet</span> : null}
                    {f && f.total.n_findings > 0 && CATEGORIES[c].group === "review" ? <Severities bySeverity={f.by_severity} /> : null}
                  </th>
                  <Cells counts={f?.total} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="t-small measure mt-4 text-slate">
        "Needs context" means the teacher thought the finding missed something about the class. A category with few findings says little either way.
      </p>
    </>
  );
}

function Cells({ counts }: { counts: Counts | undefined }) {
  const cls = "nums py-2.5 pr-6 text-right";
  if (!counts) {
    return (
      <td colSpan={5} className="t-small py-2.5 pr-6 text-slate">
        Not in the summary
      </td>
    );
  }
  return (
    <>
      <td className={cls}>{counts.n_findings}</td>
      <td className={cls}>{counts.agree}</td>
      <td className={cls}>{counts.disagree}</td>
      <td className={cls}>{counts.needs_context}</td>
      <td className={cls}>{counts.no_feedback}</td>
    </>
  );
}

function Severities({ bySeverity }: { bySeverity: Readonly<Record<string, Counts | undefined>> }) {
  const rows = SEVERITIES.filter((sv) => (bySeverity[sv]?.n_findings ?? 0) > 0);
  if (rows.length === 0) return null;
  return (
    <details className="t-small mt-1">
      <summary className="action w-fit">By severity</summary>
      <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
        {rows.map((sv) => {
          const c = bySeverity[sv];
          if (!c) return null;
          return (
            <li key={sv} className="nums">
              {SEVERITY_LABEL[sv]}: {c.n_findings} {c.n_findings === 1 ? "finding" : "findings"}, {c.agree} agree, {c.disagree} disagree, {c.needs_context} needs context,{" "}
              {c.no_feedback} no response
            </li>
          );
        })}
      </ul>
    </details>
  );
}
