import { createFileRoute } from "@tanstack/react-router";
import { useAnalysis } from "~/analysis/AnalysisGate";
import { MomentLink } from "~/analysis/links";
import { SectionOrReason } from "~/analysis/sections";
import type { ActivityType, ProblemStatus } from "~/analysis/types.gen";
import { duration, mmss, timeRange } from "~/lib/format";
import { PlayerBar, usePlayer } from "~/media/player";

export const Route = createFileRoute("/_app/lectures/$lectureId/analysis/structure")({
  component: Structure,
});

const ACTIVITY: Readonly<Record<ActivityType, string>> = {
  explanation: "Explanation",
  worked_example: "Worked example",
  student_practice: "Student practice",
  qa: "Questions and answers",
  admin: "Admin",
  unclassified: "Not classified",
};

const PROBLEM: Readonly<Record<ProblemStatus, string>> = {
  solved: "Solved in class",
  assigned: "Set for students",
  deferred: "Left for later",
  unknown: "Not clear from the recording",
};

function Structure() {
  const { lectureId } = Route.useParams();
  const a = useAnalysis();
  const player = usePlayer();
  const canPlay = player !== null && player.state.kind !== "unavailable" && player.state.kind !== "error";
  return (
    <div className="pt-2">
      <PlayerBar />
      <section aria-labelledby="sections-h" className="pt-4">
        <h2 id="sections-h" className="t-heading">
          Sections of the lesson
        </h2>
        <p className="t-small measure mt-2 text-slate">Where the lesson moved from one activity to the next, as read from the transcript.</p>
        <div className="mt-4">
          <SectionOrReason a={a} section="structure">
            <ol className="m-0 list-none p-0">
              {(a.structure?.sections ?? []).map((s) => (
                <li key={s.first_segment_id} className="grid gap-x-6 gap-y-1 border-t border-slate/25 py-3 md:grid-cols-[9rem_11rem_minmax(0,1fr)]">
                  <span className="t-small nums text-slate">
                    {timeRange(s.start_ms, s.end_ms)}
                    <span className="block">{duration((s.end_ms - s.start_ms) / 1000)}</span>
                  </span>
                  <span className="t-small font-semibold">{ACTIVITY[s.activity_type]}</span>
                  <span>
                    <span className="t-reading">{s.title}</span>
                    <span className="t-small mt-1 flex gap-4">
                      {canPlay ? (
                        <button type="button" className="action" onClick={() => { player.playFrom(s.start_ms); }}>
                          Play from {mmss(s.start_ms)}
                        </button>
                      ) : null}
                      <MomentLink lectureId={lectureId} startMs={s.start_ms}>
                        Read in transcript
                      </MomentLink>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </SectionOrReason>
        </div>
      </section>

      <section aria-labelledby="problems-h" className="mt-12">
        <h2 id="problems-h" className="t-heading">
          Problems worked on
        </h2>
        <div className="mt-4">
          <SectionOrReason a={a} section="problems">
            {(a.problems ?? []).length === 0 ? <p className="t-reading">No problems were identified in this lesson.</p> : null}
            <ol className="m-0 list-none p-0">
              {(a.problems ?? []).map((p) => (
                <li key={p.segment_ids[0]} className="grid gap-x-6 gap-y-1 border-t border-slate/25 py-4 md:grid-cols-[9rem_minmax(0,var(--measure))]">
                  <span className="t-small">
                    <span className="nums text-slate">{mmss(p.start_ms)}</span>
                    <span className="block font-semibold">{PROBLEM[p.status]}</span>
                  </span>
                  <span>
                    <span className="t-reading block">{p.problem_text}</span>
                    {p.learning_objective ? <span className="t-small mt-1 block text-slate">Objective: {p.learning_objective}</span> : null}
                    {(p.concepts ?? []).length > 0 ? <span className="t-small block text-slate">Concepts: {(p.concepts ?? []).join(", ")}</span> : null}
                    <span className="t-small mt-1 flex gap-4">
                      {canPlay ? (
                        <button type="button" className="action" onClick={() => { player.playFrom(p.start_ms); }}>
                          Play from {mmss(p.start_ms)}
                        </button>
                      ) : null}
                      <MomentLink lectureId={lectureId} startMs={p.start_ms}>
                        Read in transcript
                      </MomentLink>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </SectionOrReason>
        </div>
      </section>
    </div>
  );
}
