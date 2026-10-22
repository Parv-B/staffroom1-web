import { describe, expect, it } from "vitest";
import { changes, draftFromMetadata, effects } from "~/lectures/edit";

const meta = { board: "CBSE", grade: "10", subject: "Mathematics", chapter: "Circles", class_type: "online", class_composition: "unknown", teacher_id: null, lesson_plan: null, objectives: ["A"] };

describe("editing details", () => {
  it("sends only what changed, never retranscribe", () => {
    const before = draftFromMetadata(meta);
    expect(changes(before, before)).toEqual({ patch: { retranscribe: false }, fields: [] });
    expect(changes(before, { ...before, chapter: " Circles " }).fields).toEqual([]);
    const c = changes(before, { ...before, class_composition: "girls", objectives: "A\nB\n" });
    expect(c.patch).toEqual({ retranscribe: false, class_composition: "girls", objectives: ["A", "B"] });
    expect(c.fields).toEqual(["class_composition", "objectives"]);
  });

  it("explains what each change reruns, per the API's table", () => {
    expect(effects(["objectives", "lesson_plan"])).toEqual(["the coverage of objectives"]);
    expect(effects(["class_composition"])).toEqual(["the findings and the lesson profile"]);
    expect(effects(["chapter"])[0]).toContain("structure");
  });

  it("reads stored metadata defensively", () => {
    expect(draftFromMetadata({}).class_composition).toBe("unknown");
    expect(draftFromMetadata({ objectives: ["x", 3] }).objectives).toBe("x");
  });
});
