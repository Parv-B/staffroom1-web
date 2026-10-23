import { Link } from "@tanstack/react-router";
import { aspectLabel } from "~/findings/aspects";
import { CATEGORIES } from "~/findings/categories";
import { mmss, timeRange } from "~/lib/format";
import { firstSentence } from "./FocusLists";
import type { Finding, LectureAnalysis } from "./types.gen";

const LANE_GAP = 2.5; // % of the lesson; closer markers move to the next lane
const MAX_LANES = 3;

interface Mark {
  f: Finding;
  startMs: number;
  x: number; // % of the lesson
  lane: number;
}

/** One marker per evidence run, so a pattern seen three times shows three times. Markers that
 *  would overlap are stacked in up to three lanes. */
export function placeMarks(findings: Finding[], durationMs: number): Mark[] {
  const raw = findings
    .flatMap((f) => f.evidence.map((r) => ({ f, startMs: r.start_ms })))
    .sort((p, q) => p.startMs - q.startMs);
  const lastX: number[] = [];
  return raw.map(({ f, startMs }) => {
    const x = Math.min(
      100,
      Math.max(0, (startMs / Math.max(1, durationMs)) * 100),
    );
    let lane = lastX.findIndex((l) => x - l >= LANE_GAP);
    if (lane === -1)
      lane = lastX.length < MAX_LANES ? lastX.length : MAX_LANES - 1;
    lastX[lane] = x;
    return { f, startMs, x, lane };
  });
}

/** The lesson along its length: the outline's sections as a band, points to review above it
 *  (ochre triangles) and what worked well below it (moss circles). Each marker opens its
 *  finding. */
export function LessonTimeline({
  a,
  lectureId,
}: {
  a: LectureAnalysis;
  lectureId: string;
}) {
  const duration = a.transcript.duration_ms;
  const findings = a.findings ?? [];
  const issues = placeMarks(
    findings.filter((f) => CATEGORIES[f.category].group === "review"),
    duration,
  );
  const strengths = placeMarks(
    findings.filter((f) => CATEGORIES[f.category].group === "worked"),
    duration,
  );
  const sections = a.structure?.sections ?? [];
  const lanes = (m: Mark[]) => Math.max(1, ...m.map((x) => x.lane + 1));
  const pct = (ms: number) =>
    `${((ms / Math.max(1, duration)) * 100).toString()}%`;
  const ticks = [0.25, 0.5, 0.75].map(
    (q) => Math.round((q * duration) / 60_000) * 60_000,
  );

  return (
    <div data-lesson-timeline className="max-w-5xl">
      <MarkerRow
        marks={issues}
        lanes={lanes(issues)}
        lectureId={lectureId}
        side="above"
      />
      <div
        className="relative h-9 overflow-hidden bg-desk"
        role="list"
        aria-label="Sections of the lesson"
      >
        {sections.map((s, i) => (
          <div
            key={s.first_segment_id}
            role="listitem"
            title={`${s.title}, ${timeRange(s.start_ms, s.end_ms)}`}
            className={`t-small absolute inset-y-0 flex items-center overflow-hidden border-l-2 border-sheet px-1.5 ${i % 2 ? "bg-hatch" : "bg-desk"}`}
            style={{ left: pct(s.start_ms), width: pct(s.end_ms - s.start_ms) }}
          >
            <span className="truncate text-ink">
              <span className="sr-only">
                {timeRange(s.start_ms, s.end_ms)}:{" "}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sr-only sm:hidden">{s.title}</span>
            </span>
          </div>
        ))}
      </div>
      <MarkerRow
        marks={strengths}
        lanes={lanes(strengths)}
        lectureId={lectureId}
        side="below"
      />
      <div
        className="t-small nums relative mt-1 h-5 text-slate"
        aria-hidden="true"
      >
        <span className="absolute left-0">00:00</span>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute hidden -translate-x-1/2 sm:inline"
            style={{ left: pct(t) }}
          >
            {mmss(t)}
          </span>
        ))}
        <span className="absolute right-0">{mmss(duration)}</span>
      </div>
      <p className="t-small m-0 mt-2 flex flex-wrap gap-x-6 gap-y-1 text-slate">
        <span>
          <Triangle /> Point to review
        </span>
        <span>
          <Circle /> What worked well
        </span>
        <span>A pattern seen more than once has a marker at each moment.</span>
      </p>
    </div>
  );
}

function MarkerRow({
  marks,
  lanes,
  lectureId,
  side,
}: {
  marks: Mark[];
  lanes: number;
  lectureId: string;
  side: "above" | "below";
}) {
  const laneH = 18;
  return (
    <div
      className="relative"
      style={{ height: `${(lanes * laneH + 4).toString()}px` }}
    >
      {marks.map((m, i) => {
        const offset = 2 + m.lane * laneH;
        const aspect =
          aspectLabel(m.f.aspect) ?? CATEGORIES[m.f.category].label;
        const label = `${mmss(m.startMs)}, ${aspect}: ${firstSentence(m.f.issue)}`;
        return (
          <Link
            key={`${m.f.finding_id}-${i.toString()}`}
            to="/lectures/$lectureId/analysis/findings"
            params={{ lectureId }}
            search={{ finding: m.f.finding_id }}
            title={label}
            aria-label={label}
            data-marker={side === "above" ? "review" : "worked"}
            className="absolute -translate-x-1/2 rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-pen"
            style={{
              left: `${m.x.toString()}%`,
              ...(side === "above"
                ? { bottom: `${offset.toString()}px` }
                : { top: `${offset.toString()}px` }),
            }}
          >
            {side === "above" ? <Triangle /> : <Circle />}
          </Link>
        );
      })}
    </div>
  );
}

function Triangle() {
  return (
    <svg
      width="12"
      height="11"
      viewBox="0 0 12 11"
      aria-hidden="true"
      className="inline-block align-[-1px]"
    >
      <path d="M6 10.5 0.5 0.5h11z" fill="var(--ochre)" />
    </svg>
  );
}

function Circle() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="inline-block align-[-1px]"
    >
      <circle cx="6" cy="6" r="5.5" fill="var(--moss)" />
    </svg>
  );
}
