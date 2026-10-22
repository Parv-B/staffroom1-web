import type { Category, Severity } from "~/analysis/types.gen";

export type CategoryGroup = "worked" | "review";

interface CategoryInfo {
  /** Same words as the backend's teacher summary (report/summary.py). */
  readonly label: string;
  readonly group: CategoryGroup;
}

export const CATEGORIES: Readonly<Record<Category, CategoryInfo>> = {
  strength: { label: "What worked well", group: "worked" },
  pedagogy: { label: "Teaching practice", group: "review" },
  content_error: { label: "Content accuracy", group: "review" },
  explanation_gap: { label: "Explanation gaps", group: "review" },
  conduct: { label: "Classroom conduct", group: "review" },
};

export const CATEGORY_ORDER: readonly Category[] = ["content_error", "explanation_gap", "conduct", "pedagogy", "strength"];

export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  info: "for information",
  minor: "minor",
  moderate: "moderate",
  important: "important",
};

/** CSS custom properties for a category's rule and tint. Ochre for everything to review. */
export function categoryColours(c: Category): { rule: string; tint: string } {
  return CATEGORIES[c].group === "worked"
    ? { rule: "var(--moss)", tint: "var(--moss-tint)" }
    : { rule: "var(--ochre)", tint: "var(--ochre-tint)" };
}

/** Rule 6, per lecture: a category this lecture's report wasn't checked for (it was processed
 *  before the category was released). Owner's decision (docs/REVIEW.md): never "0", and not
 *  "still being validated" now that every category is released. */
export const NOT_CHECKED_FOR_LESSON = "Not checked for this lesson";

/** Rule 6, centre-wide: a category the centre hasn't released at all. */
export const NOT_YET_REPORTED = "Not yet reported (still being validated)";

export function isReleased(c: Category, released: readonly Category[] | undefined): boolean {
  return (released ?? []).includes(c);
}
