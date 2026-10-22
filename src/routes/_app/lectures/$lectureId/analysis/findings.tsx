import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { makeTranscriptLink } from "~/analysis/links";
import { SectionOrReason } from "~/analysis/sections";
import type { Category, Finding } from "~/analysis/types.gen";
import { FindingEntry } from "~/components/FindingEntry";
import { FindingFeedback, FindingFeedbackReadOnly } from "~/components/FindingFeedback";
import { CATEGORIES, CATEGORY_ORDER, NOT_CHECKED_FOR_LESSON } from "~/findings/categories";
import { PlayerBar } from "~/media/player";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis/findings")({
  validateSearch: (s: Record<string, unknown>): { finding?: string } =>
    typeof s.finding === "string" && /^f_[0-9a-f]{16}$/.test(s.finding) ? { finding: s.finding } : {},
  component: Findings,
});

function Findings() {
  const { lectureId } = Route.useParams();
  const { finding: target } = Route.useSearch();
  const { me } = Route.useRouteContext();
  const a = useAnalysis();
  const TranscriptLink = makeTranscriptLink(lectureId);
  const released: readonly Category[] = a.findings_summary?.released_categories ?? [];
  const findings = [...(a.findings ?? [])].sort((x, y) => x.start_ms - y.start_ms);
  const review = CATEGORY_ORDER.filter((c) => c !== "strength" && released.includes(c));
  const unreleased = CATEGORY_ORDER.filter((c) => !released.includes(c));
  const isOwnTeacher = me.role === "teacher";

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(`finding-${target}`);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.classList.add("just-landed");
  }, [target]);

  const entry = (f: Finding) => (
    <li key={f.finding_id} id={`finding-${f.finding_id}`} data-scroll-target className="border-t border-slate/25 py-8 first:border-t-0">
      <FindingEntry finding={f} TranscriptLink={TranscriptLink} />
      {isOwnTeacher ? <FindingFeedback findingId={f.finding_id} /> : me.role === "admin" ? <FindingFeedbackReadOnly findingId={f.finding_id} /> : null}
    </li>
  );

  return (
    <div className="pt-2">
      <PlayerBar />
      <div className="pt-4">
        <SectionOrReason a={a} section="findings">
          <p className="t-small measure text-slate">
            Reported in this analysis: {released.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ") || "no categories"}.
            {unreleased.length > 0 ? ` ${NOT_CHECKED_FOR_LESSON}: ${unreleased.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ")}. Nothing is shown for these, which doesn't mean nothing happened.` : ""}
          </p>

          {review.length > 0 ? (
            <section aria-labelledby="review-h" className="mt-8">
              <h2 id="review-h" className="t-heading">
                Points to review
              </h2>
              {(() => {
                const list = findings.filter((f) => review.includes(f.category));
                return list.length > 0 ? (
                  <ol className="m-0 mt-2 list-none p-0">{list.map(entry)}</ol>
                ) : (
                  <p className="t-reading measure mt-3">
                    None in this lesson in the reported {review.length === 1 ? "category" : "categories"} ({review.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ")}).
                  </p>
                );
              })()}
            </section>
          ) : null}

          {released.includes("strength") ? (
            <section aria-labelledby="worked-h" className="mt-12">
              <h2 id="worked-h" className="t-heading">
                What worked well
              </h2>
              {(() => {
                const list = findings.filter((f) => f.category === "strength");
                return list.length > 0 ? <ol className="m-0 mt-2 list-none p-0">{list.map(entry)}</ol> : <p className="t-reading measure mt-3">None reported in this lesson.</p>;
              })()}
            </section>
          ) : null}
        </SectionOrReason>
      </div>
    </div>
  );
}
