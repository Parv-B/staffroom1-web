import { relative } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotesReading, NotesStatus } from "~/notes/NotesView";
import type { NotesOut } from "~/notes/model";
import { WithPlayer, segment } from "./fixtures";
import { SRC, renderableText, sourceFiles } from "./source-text";

const SEND = /send (?:them |these |the notes |notes )?to (?:the |your )?students|share with students|publish to students|email (?:to )?students/i;

function notes(over: Partial<NotesOut> = {}): NotesOut {
  return {
    lecture_id: "lec_0123456789abcdef",
    source: "pipeline",
    status: "draft_requires_teacher_approval",
    sections: [{ heading: "Synthetic heading", bullets: [{ text: "Synthetic bullet.", segment_ids: ["s0010", "s0404"] }] }],
    markdown: "",
    stale: false,
    based_on_current_report: true,
    ...over,
  };
}

describe("rule 11: lecture notes are a draft until the teacher approves them, never sent to students", () => {
  it("labels a pipeline draft as a draft, for the teacher and for others", () => {
    render(<NotesStatus notes={notes()} viewerIsTeacher />);
    expect(screen.getByText("Draft, not approved")).toBeInTheDocument();
    expect(screen.getByText(/Students shouldn't get these notes until you approve them/)).toBeInTheDocument();
    expect(screen.getByText(/Written by Staffroom1 from the transcript/)).toBeInTheDocument();
    expect(screen.queryByText(/^Approved/)).toBeNull();
  });

  it("an edited but unapproved teacher version is still a draft", () => {
    render(<NotesStatus notes={notes({ source: "teacher", edited_at: "2026-10-21T10:00:00Z" })} viewerIsTeacher={false} />);
    expect(screen.getByText("Draft, not approved")).toBeInTheDocument();
    expect(screen.getByText(/The teacher's version, last saved on 21 October 2026/)).toBeInTheDocument();
  });

  it("says who approved and when", () => {
    render(<NotesStatus notes={notes({ source: "teacher", status: "approved", approved_at: "2026-10-21T10:00:00Z" })} viewerIsTeacher={false} />);
    expect(screen.getByText("Approved by the teacher on 21 October 2026")).toBeInTheDocument();
    expect(screen.queryByText("Draft, not approved")).toBeNull();
  });

  it("flags stale notes with their reason, even when approved", () => {
    const { container } = render(<NotesStatus notes={notes({ status: "approved", stale: true, stale_reason: "2 bullets cite lines that changed." })} viewerIsTeacher />);
    expect(screen.getByText("Out of date")).toBeInTheDocument();
    expect(screen.getByText(/2 bullets cite lines that changed\./)).toBeInTheDocument();
    expect(container.querySelector("[data-stale]")).not.toBeNull();
  });

  it("says a cited line is missing instead of dropping it", () => {
    const byId = new Map([["s0010", segment("s0010", 61_000, "teacher", "One.")]]);
    render(
      <WithPlayer>
        <NotesReading notes={notes()} segmentsById={byId} />
      </WithPlayer>,
    );
    expect(screen.getByText(/s0404 \(no longer in the transcript\)/)).toBeInTheDocument();
  });

  it("no text in the app offers to send notes to students", () => {
    const hits = sourceFiles().flatMap((f) => renderableText(f).filter((t) => SEND.test(t)).map((t) => `${relative(SRC, f)}: ${t}`));
    expect(hits).toEqual([]);
    expect(SEND.test("Send to students")).toBe(true);
  });
});
