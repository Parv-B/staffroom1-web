import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { TranscriptLinkProps } from "~/components/FindingEntry";

/** "Read in transcript": opens the transcript at a moment, with the finding highlighted. */
export function makeTranscriptLink(lectureId: string) {
  return function TranscriptLink({ startMs, findingId, children }: TranscriptLinkProps) {
    return (
      <Link to="/lectures/$lectureId/transcript" params={{ lectureId }} search={{ t: startMs, finding: findingId }} className="action">
        {children}
      </Link>
    );
  };
}

export function makeFindingLink(lectureId: string) {
  return function FindingLink({ findingId, children }: { findingId: string; children: ReactNode }) {
    return (
      <Link to="/lectures/$lectureId/analysis/findings" params={{ lectureId }} search={{ finding: findingId }} className="action">
        {children}
      </Link>
    );
  };
}

/** A transcript link for a bare moment (structure, coverage, problems). */
export function MomentLink({ lectureId, startMs, children }: { lectureId: string; startMs: number; children: ReactNode }) {
  return (
    <Link to="/lectures/$lectureId/transcript" params={{ lectureId }} search={{ t: startMs }} className="action">
      {children}
    </Link>
  );
}
