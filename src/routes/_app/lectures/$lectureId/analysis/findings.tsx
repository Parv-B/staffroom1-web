import { type ReactNode, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { makeTranscriptLink } from "~/analysis/links";
import { SectionOrReason } from "~/analysis/sections";
import type { Category, Finding } from "~/analysis/types.gen";
import { FindingEntry } from "~/components/FindingEntry";
import {
  FindingFeedback,
  FindingFeedbackReadOnly,
} from "~/components/FindingFeedback";
import { ASPECTS, type Aspect, aspectLabel } from "~/findings/aspects";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  CURRENT_CATEGORIES,
  NOT_CHECKED_FOR_LESSON,
  isLegacy,
} from "~/findings/categories";
import { PlayerBar } from "~/media/player";

export const Route = createFileRoute(
  "/_app/lectures/$lectureId/analysis/findings",
)({
  validateSearch: (
    s: Record<string, unknown>,
  ): { finding?: string; aspect?: Aspect } => ({
    ...(typeof s.finding === "string" && /^f_[0-9a-f]{16}$/.test(s.finding)
      ? { finding: s.finding }
      : {}),
    ...(typeof s.aspect === "string" && ASPECTS.some((x) => x.id === s.aspect)
      ? { aspect: s.aspect as Aspect }
      : {}),
  }),
  component: Findings,
});

function Findings() {
  const { lectureId } = Route.useParams();
  const { finding: target, aspect } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { me } = Route.useRouteContext();
  const a = useAnalysis();
  const TranscriptLink = makeTranscriptLink(lectureId);
  const released: readonly Category[] =
    a.findings_summary?.released_categories ?? [];
  const all = [...(a.findings ?? [])].sort((x, y) => x.start_ms - y.start_ms);
  const present = new Set(all.map((f) => f.category));
  // Retired categories count only where this (older) analysis has findings in them.
  const shown = released.filter((c) => !isLegacy(c) || present.has(c));
  const review = CATEGORY_ORDER.filter(
    (c) => c !== "strength" && shown.includes(c),
  );
  const unreleased = CURRENT_CATEGORIES.filter((c) => !released.includes(c));
  const aspectsPresent = ASPECTS.filter((x) =>
    all.some((f) => f.aspect === x.id),
  );
  const findings = aspect ? all.filter((f) => f.aspect === aspect) : all;
  const isOwnTeacher = me.role === "teacher";

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(`finding-${target}`);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.classList.add("just-landed");
  }, [target]);

  const entry = (f: Finding) => (
    <li
      key={f.finding_id}
      id={`finding-${f.finding_id}`}
      data-scroll-target
      className="border-t border-slate/25 py-8 first:border-t-0"
    >
      <FindingEntry
        finding={f}
        TranscriptLink={TranscriptLink}
        headingLevel={4}
      />
      {isOwnTeacher ? (
        <FindingFeedback findingId={f.finding_id} />
      ) : me.role === "admin" ? (
        <FindingFeedbackReadOnly findingId={f.finding_id} />
      ) : null}
    </li>
  );

  return (
    <div className="pt-2">
      <PlayerBar />
      <div className="pt-4">
        <SectionOrReason a={a} section="findings">
          <p className="t-small measure text-slate">
            Reported in this analysis:{" "}
            {shown.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ") ||
              "no categories"}
            .
            {unreleased.length > 0
              ? ` ${NOT_CHECKED_FOR_LESSON}: ${unreleased.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ")}. Nothing is shown for these, which doesn't mean nothing happened.`
              : ""}
          </p>

          {aspectsPresent.length > 1 || aspect ? (
            <p
              className="t-ui mt-4 flex flex-wrap items-center gap-2"
              data-no-print
            >
              <label htmlFor="aspect-filter" className="t-small font-semibold">
                Show
              </label>
              <select
                id="aspect-filter"
                className="t-ui rounded border border-slate/50 bg-sheet px-2 py-1"
                value={aspect ?? ""}
                onChange={(e) => {
                  const v = e.target.value as Aspect | "";
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      aspect: v || undefined,
                      finding: undefined,
                    }),
                    replace: true,
                  });
                }}
              >
                <option value="">All aspects of the lesson</option>
                {aspectsPresent.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </p>
          ) : null}

          {review.length > 0 ? (
            <section aria-labelledby="review-h" className="mt-8">
              <h2 id="review-h" className="t-heading">
                Points to review
              </h2>
              {(() => {
                const list = findings.filter((f) =>
                  review.includes(f.category),
                );
                return list.length > 0 ? (
                  <ByAspect list={list} entry={entry} />
                ) : aspect ? (
                  <p className="t-reading measure mt-3">
                    None for {aspectLabel(aspect)?.toLowerCase()} in this
                    lesson.
                  </p>
                ) : (
                  <p className="t-reading measure mt-3">
                    None in this lesson in the reported{" "}
                    {review.length === 1 ? "category" : "categories"} (
                    {review
                      .map((c) => CATEGORIES[c].label.toLowerCase())
                      .join(", ")}
                    ).
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
                return list.length > 0 ? (
                  <ByAspect list={list} entry={entry} />
                ) : (
                  <p className="t-reading measure mt-3">
                    None reported in this lesson.
                  </p>
                );
              })()}
            </section>
          ) : null}
        </SectionOrReason>
      </div>
    </div>
  );
}

/** Findings grouped by the aspect of the lesson they're about (in the aspects' order), each
 *  group in time order. Findings from older analyses have no aspect and come last. */
function ByAspect({
  list,
  entry,
}: {
  list: Finding[];
  entry: (f: Finding) => ReactNode;
}) {
  const groups = [
    ...ASPECTS.map((x) => ({
      key: x.id,
      label: x.label,
      items: list.filter((f) => f.aspect === x.id),
    })),
    { key: "other", label: "Other", items: list.filter((f) => !f.aspect) },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 1 && groups[0]?.key === "other")
    return <ol className="m-0 mt-2 list-none p-0">{list.map(entry)}</ol>;
  return (
    <div className="mt-2 space-y-6">
      {groups.map((g) => (
        <div key={g.key} data-aspect-group={g.key}>
          <h3 className="t-subheading mt-6 text-slate">{g.label}</h3>
          <ol className="m-0 list-none p-0">{g.items.map(entry)}</ol>
        </div>
      ))}
    </div>
  );
}
