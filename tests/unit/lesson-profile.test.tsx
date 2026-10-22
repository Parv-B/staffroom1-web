import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LessonProfile } from "~/analysis/LessonProfile";
import type { AspectJudgement } from "~/analysis/types.gen";
import { ASPECTS } from "~/findings/aspects";
import { analysis, finding } from "./fixtures";

const FindingLink = ({
  findingId,
  children,
}: {
  findingId: string;
  children: ReactNode;
}) => <a href={`#${findingId}`}>{children}</a>;
const MomentLink = ({
  startMs,
  children,
}: {
  startMs: number;
  children: ReactNode;
}) => <a href={`#t${startMs.toString()}`}>{children}</a>;

function judgement(
  over: Partial<
    Record<AspectJudgement["aspect"], Partial<AspectJudgement>>
  > = {},
): AspectJudgement[] {
  return ASPECTS.map(
    (x) =>
      ({
        aspect: x.id,
        level: null,
        reason_if_no_level: "not shown in this lesson",
        ...over[x.id],
      }),
  );
}

describe("lesson profile", () => {
  it("shows each rated aspect with its level, descriptor, next step and evidence", () => {
    const f = finding({
      finding_id: "f_00000000000000aa",
      issue: "Questions answered by the teacher",
    });
    const aspects = judgement({
      questioning_dialogue: {
        level: "acceptable",
        reason_if_no_level: null,
        matched_descriptor:
          "Questions keep students willing to participate but are mostly recall.",
        evidence: [
          {
            segment_ids: ["s0010"],
            start_ms: 61_000,
            end_ms: 62_000,
            quote: "One.",
          },
        ],
        supporting_finding_ids: ["f_00000000000000aa"],
        next_step: "Wait before answering.",
      },
    });
    const [first, ...rest] = aspects;
    if (!first) throw new Error("no aspects");
    render(
      <LessonProfile
        a={analysis({
          findings: [f],
          lesson_judgement: { aspects: [first, ...rest] },
        })}
        FindingLink={FindingLink}
        MomentLink={MomentLink}
      />,
    );
    const row = document.querySelector('[data-aspect="questioning_dialogue"]');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("Questioning and dialogue");
    expect(row).toHaveTextContent("Acceptable");
    expect(row).toHaveTextContent("mostly recall");
    expect(row).toHaveTextContent("Next step: Wait before answering.");
    expect(
      screen.getByRole("link", { name: "Questions answered by the teacher" }),
    ).toHaveAttribute("href", "#f_00000000000000aa");
    expect(
      screen.getByText(/10 aspects couldn't be rated/),
    ).toBeInTheDocument();
    expect(document.body.textContent).toContain("Good is the level expected");
  });

  it("says why it's missing, including for lectures analysed before profiles existed", () => {
    render(
      <LessonProfile
        a={analysis({
          unavailable: { lesson_judgement: "LLM calls are disabled" },
        })}
        FindingLink={FindingLink}
        MomentLink={MomentLink}
      />,
    );
    expect(
      screen.getByText("Reason: LLM calls are disabled"),
    ).toBeInTheDocument();
  });

  it("explains an older analysis without a recorded reason", () => {
    render(
      <LessonProfile
        a={analysis()}
        FindingLink={FindingLink}
        MomentLink={MomentLink}
      />,
    );
    expect(
      screen.getByText(/analysed before lesson profiles existed/),
    ).toBeInTheDocument();
  });
});
