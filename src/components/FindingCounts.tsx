import type { Category, Severity } from "~/analysis/types.gen";
import { CATEGORIES, NOT_YET_REPORTED } from "~/findings/categories";

// Teacher-facing order: what worked well first.
const DISPLAY_ORDER: readonly Category[] = ["strength", "pedagogy", "content_error", "explanation_gap", "conduct"];
const SEVERITY_ORDER: readonly Severity[] = ["important", "moderate", "minor", "info"];

type BySeverity = Readonly<Record<string, number | undefined>>;
type Counts = Readonly<Record<string, BySeverity | undefined>>;

function total(bySeverity: BySeverity | undefined): number {
  return Object.values(bySeverity ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);
}

/** Rule 6. `released` is the categories this lecture was checked for (`released_categories`
 *  on list and detail items, or the analysis' own). Null means the lecture has no report yet:
 *  then only categories with findings are shown and nothing is claimed about the rest. A
 *  category that isn't released is never shown as zero. */
export function FindingCounts({ counts, released }: { counts: Counts; released: readonly Category[] | null }) {
  const rows: { category: Category; n: number; detail: string | null }[] = [];
  const unreleased: Category[] = [];
  for (const c of DISPLAY_ORDER) {
    const n = total(counts[c]);
    const isReleased = released ? released.includes(c) : n > 0;
    if (!isReleased && released !== null) {
      if (n > 0) rows.push({ category: c, n, detail: severityDetail(c, counts[c]) });
      else unreleased.push(c);
      continue;
    }
    if (isReleased) rows.push({ category: c, n, detail: severityDetail(c, counts[c]) });
  }
  return (
    <div className="t-small">
      <ul className="m-0 list-none space-y-0.5 p-0">
        {rows.map((r) => (
          <li key={r.category}>
            <span className={CATEGORIES[r.category].group === "worked" ? "text-moss" : "text-ochre"}>{CATEGORIES[r.category].label}</span>{" "}
            {r.n === 0 ? <span className="text-slate">none</span> : <span className="nums font-semibold">{r.n}</span>}
            {r.detail ? <span className="text-slate"> ({r.detail})</span> : null}
          </li>
        ))}
      </ul>
      {unreleased.length > 0 ? (
        <p className="mt-1 text-slate" data-unreleased>
          {NOT_YET_REPORTED}: {unreleased.map((c) => CATEGORIES[c].label.toLowerCase()).join(", ")}
        </p>
      ) : null}
      {released === null ? <p className="mt-1 text-slate">Other categories: open the analysis</p> : null}
    </div>
  );
}

function severityDetail(c: Category, bySeverity: BySeverity | undefined): string | null {
  if (CATEGORIES[c].group === "worked" || !bySeverity) return null;
  const parts = SEVERITY_ORDER.filter((s) => (bySeverity[s] ?? 0) > 0).map((s) => `${(bySeverity[s] ?? 0).toString()} ${s}`);
  return parts.length > 1 ? parts.join(", ") : parts.length === 1 && total(bySeverity) > 0 ? (parts[0] ?? null) : null;
}
