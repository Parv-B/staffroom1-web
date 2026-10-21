import type { ReactNode } from "react";

export type StatusKind = "low-confidence" | "stale" | "draft" | "approved" | "not-shared" | "suggested" | "suggested-tentative";

// Each status has its own hue AND its own shape and word, so none relies on colour alone, and
// none borrows a severity colour.
const STYLE: Record<StatusKind, { className: string; icon: ReactNode; label: string }> = {
  "low-confidence": {
    className: "text-heather bg-heather-tint border border-dotted border-heather",
    icon: <HalfCircle />,
    label: "Low confidence",
  },
  stale: { className: "text-lagoon bg-lagoon-tint border-l-4 border-lagoon", icon: <Clock />, label: "Out of date" },
  draft: { className: "text-slate border border-dashed border-slate", icon: <Pencil />, label: "Draft, not approved" },
  approved: { className: "text-pen border border-pen", icon: <Check />, label: "Approved" },
  "not-shared": { className: "text-ink bg-desk", icon: <Lock />, label: "Not shared by the teacher" },
  // AI suggestions are provisional until the teacher keeps or edits them: dashed like a draft;
  // a weak one uses the low-confidence hue.
  suggested: { className: "text-slate border border-dashed border-slate", icon: <Pencil />, label: "Suggested from the recording" },
  "suggested-tentative": { className: "text-heather border border-dashed border-heather", icon: <HalfCircle />, label: "Tentative suggestion" },
};

export function StatusMark({ kind, children }: { kind: StatusKind; children?: ReactNode }) {
  const s = STYLE[kind];
  return (
    <span className={`t-small inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 font-semibold ${s.className}`}>
      <span aria-hidden="true" className="inline-flex size-[1em]">
        {s.icon}
      </span>
      {children ?? s.label}
    </span>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function HalfCircle() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" stroke="none" />
    </Svg>
  );
}
function Clock() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </Svg>
  );
}
function Pencil() {
  return (
    <Svg>
      <path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z" />
    </Svg>
  );
}
function Check() {
  return (
    <Svg>
      <path d="M3 8.5l3 3 7-7" />
    </Svg>
  );
}
function Lock() {
  return (
    <Svg>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Svg>
  );
}
