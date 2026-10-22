import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, renderableText, sourceFiles } from "./source-text";

// Rule 3: no scores, indices, percentiles, grades-as-ratings, rankings or "engagement" anywhere
// in the UI. This walks every string and JSX text the app can render (comments are ignored).
// (The lesson profile's six named levels per aspect were approved by the owner on 2026-10-22;
// they are descriptors, not numbers, and are never combined into an overall rating.)
const FORBIDDEN = /\b(scores?|scoring|percentiles?|rank(?:s|ed|ing|ings)?|leaderboard|engagement|overall rating|best teacher|worst teacher|top teacher|index score)\b/i;

describe("rule 3: no scores", () => {
  it("has no score-like words in any text the app renders", () => {
    const hits = sourceFiles().flatMap((f) => renderableText(f).filter((t) => FORBIDDEN.test(t)).map((t) => `${relative(SRC, f)}: ${t}`));
    expect(hits).toEqual([]);
  });

  it("the check itself catches a score", () => {
    expect(FORBIDDEN.test("Overall score 90%")).toBe(true);
    expect(FORBIDDEN.test("Better than 95% of teachers (percentile)")).toBe(true);
    expect(FORBIDDEN.test("CBSE grade 10 Mathematics")).toBe(false);
  });
});
