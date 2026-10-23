import type { ReactNode } from "react";
import {
  ASPECTS,
  LEVEL_LABEL,
  LEVELS,
  type Level,
  levelRank,
  levelTone,
} from "~/findings/aspects";
import type { AspectJudgement, LessonJudgement } from "./types.gen";

const DOT = {
  above: "bg-moss",
  expected: "bg-ink",
  below: "bg-ochre",
} as const;
const WORD = {
  above: "text-moss",
  expected: "text-ink",
  below: "text-ochre",
} as const;

/** Worst to best, left to right. */
const COLUMNS: readonly Level[] = [...LEVELS].reverse();
const ORDER = new Map(ASPECTS.map((a, i) => [a.id, i]));

/** The lesson profile at a glance: one row per rated aspect, weakest first, with a dot at its
 *  level on a six-step track. The "good" column is shaded as the expected level. Each label
 *  jumps to the aspect's full entry (`#aspect-<id>`). */
export function ProfileChart({ j }: { j: LessonJudgement }) {
  const rated = j.aspects
    .filter((x): x is AspectJudgement & { level: Level } => x.level != null)
    .sort(
      (p, q) =>
        levelRank(p.level) - levelRank(q.level) ||
        (ORDER.get(p.aspect) ?? 0) - (ORDER.get(q.aspect) ?? 0),
    );
  const unrated = j.aspects.length - rated.length;
  if (rated.length === 0) {
    return (
      <p className="t-reading measure m-0">
        No aspect could be rated from this recording.
      </p>
    );
  }
  return (
    <div data-profile-chart className="max-w-4xl">
      <div
        className="hidden sm:grid sm:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] sm:gap-x-6"
        aria-hidden="true"
      >
        <span />
        <Track>
          {COLUMNS.map((l) => (
            <span
              key={l}
              className={`t-small px-1 pb-1 text-center leading-tight ${l === "good" ? "font-semibold text-ink" : "text-slate"}`}
            >
              {LEVEL_LABEL[l]}
              {l === "good" ? (
                <span className="block font-normal text-slate">expected</span>
              ) : null}
            </span>
          ))}
        </Track>
      </div>
      <ul className="m-0 list-none p-0">
        {rated.map((x) => {
          const tone = levelTone(x.level);
          const label =
            ASPECTS.find((a) => a.id === x.aspect)?.label ?? x.aspect;
          return (
            <li
              key={x.aspect}
              data-aspect={x.aspect}
              data-level={x.level}
              className="grid gap-x-6 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] sm:items-stretch sm:py-0"
            >
              <span className="t-ui flex items-baseline justify-between gap-3 sm:py-1.5">
                <a href={`#aspect-${x.aspect}`} className="action">
                  {label}
                </a>
                <span className={`t-small font-semibold ${WORD[tone]}`}>
                  {LEVEL_LABEL[x.level]}
                </span>
              </span>
              <Track>
                {COLUMNS.map((l) => (
                  <span
                    key={l}
                    className={`relative flex min-h-6 items-center justify-center ${l === "good" ? "bg-desk" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-px bg-slate/25" />
                    {l === x.level ? (
                      <span
                        className={`relative inline-block h-3.5 w-3.5 rounded-full ${DOT[tone]}`}
                      />
                    ) : null}
                  </span>
                ))}
              </Track>
            </li>
          );
        })}
      </ul>
      <p className="t-small m-0 mt-3 text-slate sm:hidden">
        Tracks run from very weak on the left to outstanding on the right; the
        shaded step is good, the expected level.
      </p>
      {unrated > 0 ? (
        <p className="t-small m-0 mt-2 text-slate">
          {unrated === 1
            ? "1 aspect couldn't be rated from this recording."
            : `${unrated.toString()} aspects couldn't be rated from this recording.`}
        </p>
      ) : null}
    </div>
  );
}

function Track({ children }: { children: ReactNode }) {
  return <span className="grid grid-cols-6">{children}</span>;
}
