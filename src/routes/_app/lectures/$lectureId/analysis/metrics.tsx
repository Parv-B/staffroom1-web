import { createFileRoute } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { QualityWarnings, SectionOrReason } from "~/analysis/sections";
import type { MetricResult, SeriesResult } from "~/analysis/types.gen";
import { MetricValue } from "~/components/MetricValue";
import { WpmChart } from "~/components/WpmChart";
import { metricLabel } from "~/metrics/labels";
import { fromResult, isScalar } from "~/metrics/reading";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis/metrics")({
  component: Metrics,
});

const GROUPS: readonly [string, readonly string[]][] = [
  ["Who talked, and for how long", ["teacher_talk_time_s", "student_talk_time_s", "student_talk_share", "silence_time_s", "longest_teacher_monologue_s", "teacher_monologue_median_s", "student_turn_count", "student_turn_median_s"]],
  ["Questions", ["teacher_question_count", "open_question_count", "closed_question_count", "check_in_count", "rhetorical_question_count", "open_question_share"]],
  ["Waiting after a question", ["wait_time_median_s", "wait_time_p25_s", "wait_time_p75_s", "teacher_resumed_before_response_rate"]],
  ["Pace", ["teacher_wpm", "teacher_wpm_series"]],
  ["Time by activity", ["time_on_task_explanation_s", "time_on_task_worked_example_s", "time_on_task_student_practice_s", "time_on_task_qa_s", "time_on_task_admin_s", "time_on_task_unclassified_s"]],
  ["Languages heard", ["language_share_en", "language_share_hi", "language_share_ar", "language_share_neutral", "language_share_hi_teacher"]],
];

function Metrics() {
  const a = useAnalysis();
  const metrics = a.metrics ?? {};
  const grouped = new Set(GROUPS.flatMap(([, names]) => names));
  const other = Object.keys(metrics).filter((n) => !grouped.has(n)).sort();
  const groups: [string, readonly string[]][] = other.length ? [...GROUPS, ["Other measures", other]] : [...GROUPS];
  return (
    <div className="space-y-12 pt-6">
      <div className="measure space-y-3">
        <p className="t-reading m-0">
          Each measure is counted from the transcript by fixed rules, the same way for every lecture. A measure that couldn't be
          worked out shows N/A with the reason; one that rests on uncertain input is marked low confidence.
        </p>
        <QualityWarnings a={a} intro="about the recording and how it was processed. Some affect these measures." />
      </div>
      <SectionOrReason a={a} section="metrics">
        {groups.map(([title, names]) => (
          <section key={title} aria-labelledby={`g-${title}`}>
            <h2 id={`g-${title}`} className="t-subheading">
              {title}
            </h2>
            <dl className="m-0 mt-3 border-b border-slate/25">
              {names.map((name) => {
                const m: MetricResult | SeriesResult | undefined = metrics[name];
                return (
                  <div key={name} className="grid gap-x-8 gap-y-1 border-t border-slate/25 py-3 md:grid-cols-[18rem_minmax(0,1fr)]">
                    <dt className="t-ui">
                      {metricLabel(name)}
                      {m ? (
                        <details className="t-small mt-1 text-slate">
                          <summary className="action w-fit">How it's worked out</summary>
                          <p className="measure mt-1">{m.definition}</p>
                          <p className="measure mt-1">Source: {m.data_source}.</p>
                        </details>
                      ) : null}
                    </dt>
                    <dd className="m-0 min-w-0">
                      {!m ? (
                        <MetricValue reading={{ name, value: null, unit: "", lowConfidence: false, nullReason: "Not in this analysis.", lowConfidenceReason: null }} />
                      ) : !isScalar(m) ? (
                        name === "teacher_wpm_series" ? <WpmChart series={m} /> : <p className="t-small text-slate">A series of {m.values.length} values; this page doesn't draw it yet.</p>
                      ) : (
                        <MetricValue reading={fromResult(name, m)} />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </SectionOrReason>
    </div>
  );
}
