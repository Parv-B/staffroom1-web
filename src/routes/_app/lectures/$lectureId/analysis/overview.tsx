import { Link, createFileRoute } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { statusLabel } from "~/analysis/CoverageView";
import { MomentLink, makeFindingLink } from "~/analysis/links";
import { QualityWarnings, SectionOrReason } from "~/analysis/sections";
import { FocusLists } from "~/analysis/FocusLists";
import { LessonProfile } from "~/analysis/LessonProfile";
import { LessonTimeline } from "~/analysis/LessonTimeline";
import { ProfileChart } from "~/analysis/ProfileChart";
import { TeacherSummary } from "~/analysis/TeacherSummary";
import type { CoverageStatus } from "~/analysis/types.gen";
import { FindingCounts } from "~/components/FindingCounts";
import { MetricValue } from "~/components/MetricValue";
import { metricLabel } from "~/metrics/labels";
import { fromResult, isScalar } from "~/metrics/reading";

export const Route = createFileRoute(
  "/_app/lectures/$lectureId/analysis/overview",
)({
  component: Overview,
});

const KEY = [
  "teacher_talk_time_s",
  "student_talk_share",
  "teacher_question_count",
  "wait_time_median_s",
  "teacher_wpm",
] as const;

function Overview() {
  const { lectureId } = Route.useParams();
  const a = useAnalysis();
  const FindingLink = makeFindingLink(lectureId);
  const c = a.coverage;
  return (
    <div className="space-y-12 pt-6">
      {a.lesson_judgement ? (
        <section aria-labelledby="glance-h">
          <h2 id="glance-h" className="t-heading">
            Lesson at a glance
          </h2>
          <p className="t-small measure m-0 mt-2 text-slate">
            Each aspect of the lesson on six levels, weakest first.{" "}
            <span className="font-semibold text-ink">Good</span> is the level
            expected of every lesson. Select an aspect for what it rests on and
            a next step.
          </p>
          <div className="mt-5">
            <ProfileChart j={a.lesson_judgement} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="when-h">
        <h2 id="when-h" className="t-heading">
          Where it happened
        </h2>
        <div className="mt-4">
          <SectionOrReason a={a} section="findings">
            <LessonTimeline a={a} lectureId={lectureId} />
          </SectionOrReason>
        </div>
      </section>

      <section aria-labelledby="focus-h">
        <h2 id="focus-h" className="sr-only">
          What matters most
        </h2>
        <SectionOrReason a={a} section="findings">
          <FocusLists
            a={a}
            lectureId={lectureId}
            FindingLink={FindingLink}
            MomentLink={({ startMs, children }) => (
              <MomentLink lectureId={lectureId} startMs={startMs}>
                {children}
              </MomentLink>
            )}
          />
        </SectionOrReason>
      </section>

      <section aria-labelledby="profile-h">
        <h2 id="profile-h" className="t-heading">
          Each aspect in detail
        </h2>
        <div className="mt-4">
          <LessonProfile
            a={a}
            FindingLink={FindingLink}
            MomentLink={({ startMs, children }) => (
              <MomentLink lectureId={lectureId} startMs={startMs}>
                {children}
              </MomentLink>
            )}
          />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="findings-h">
          <h2 id="findings-h" className="t-subheading">
            Findings
          </h2>
          <div className="mt-3">
            <SectionOrReason a={a} section="findings">
              <FindingCounts
                counts={
                  a.findings_summary?.counts_by_category_and_severity ?? {}
                }
                released={a.findings_summary?.released_categories ?? null}
              />
              <p className="t-small mt-3">
                <Link
                  to="/lectures/$lectureId/analysis/findings"
                  params={{ lectureId }}
                  className="action"
                >
                  Read the findings with their evidence
                </Link>
              </p>
            </SectionOrReason>
          </div>
        </section>
        <section aria-labelledby="coverage-h">
          <h2 id="coverage-h" className="t-subheading">
            Objectives
          </h2>
          <div className="mt-3">
            <SectionOrReason a={a} section="coverage">
              {c ? (
                <>
                  <p className="t-ui nums m-0">
                    {(
                      ["covered", "partial", "not_covered", "deferred"] as const
                    )
                      .filter((k) => k in c.summary_counts)
                      .map(
                        (k: CoverageStatus) =>
                          `${String(c.summary_counts[k])} ${statusLabel(k, c.not_covered_means).toLowerCase()}`,
                      )
                      .join(", ")}
                  </p>
                  {!c.objectives_reviewed ? (
                    <p className="t-small mt-1 text-slate">
                      From an objective list no one has reviewed yet.
                    </p>
                  ) : null}
                  <p className="t-small mt-3">
                    <Link
                      to="/lectures/$lectureId/analysis/coverage"
                      params={{ lectureId }}
                      className="action"
                    >
                      See each objective
                    </Link>
                  </p>
                </>
              ) : null}
            </SectionOrReason>
          </div>
        </section>
      </div>

      <section aria-labelledby="measures-h">
        <h2 id="measures-h" className="t-subheading">
          Key measures
        </h2>
        <div className="mt-3">
          <SectionOrReason a={a} section="metrics">
            <dl className="m-0 max-w-3xl">
              {KEY.map((name) => {
                const m = a.metrics?.[name];
                return (
                  <div
                    key={name}
                    className="grid gap-x-6 border-t border-slate/25 py-2.5 sm:grid-cols-[16rem_1fr]"
                  >
                    <dt className="t-ui">{metricLabel(name)}</dt>
                    <dd className="m-0">
                      {m && isScalar(m) ? (
                        <MetricValue reading={fromResult(name, m)} />
                      ) : (
                        <MetricValue
                          reading={{
                            name,
                            value: null,
                            unit: "",
                            lowConfidence: false,
                            nullReason: "Not in this analysis.",
                            lowConfidenceReason: null,
                          }}
                        />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="t-small mt-3">
              <Link
                to="/lectures/$lectureId/analysis/metrics"
                params={{ lectureId }}
                className="action"
              >
                All measures, with how each is worked out
              </Link>
            </p>
          </SectionOrReason>
        </div>
      </section>

      <section aria-labelledby="summary-h">
        <h2 id="summary-h" className="t-subheading">
          Written summary
        </h2>
        <div className="mt-3">
          <SectionOrReason a={a} section="teacher_summary">
            <details>
              <summary className="t-small cursor-pointer text-slate">
                The same points as plain text, for copying into a message
              </summary>
              <div className="mt-3">
                <TeacherSummary a={a} FindingLink={FindingLink} />
              </div>
            </details>
          </SectionOrReason>
        </div>
      </section>

      <QualityWarnings
        a={a}
        intro="about the recording and how it was processed. Some affect the numbers above."
      />
    </div>
  );
}
