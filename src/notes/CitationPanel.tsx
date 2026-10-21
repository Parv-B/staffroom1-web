import { useDeferredValue, useEffect, useRef, useState } from "react";
import { CheckboxButton, CheckboxField, Input, Label, SearchField } from "react-aria-components";
import type { Segment } from "~/analysis/types.gen";
import { SPEAKER_LABEL } from "~/components/TranscriptLines";
import { mmss } from "~/lib/format";
import { usePlayer } from "~/media/player";
import { MAX_CITED } from "./model";

export interface ActiveBullet {
  readonly section: string;
  readonly bullet: string;
  /** e.g. "bullet 2 of “Volume of combined solids”" */
  readonly label: string;
  readonly segmentIds: readonly string[];
}

interface Props {
  segments: readonly Segment[];
  active: ActiveBullet | null;
  onToggle: (segmentId: string) => void;
  onDone: () => void;
}

/** The redacted transcript beside the editor: tick the lines a bullet is based on. The text is
 *  shown exactly as the API gives it ([student] stays [student]). */
export function CitationPanel({ segments, active, onToggle, onDone }: Props) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const listRef = useRef<HTMLOListElement>(null);
  const player = usePlayer();
  const canPlay = player !== null && player.state.kind !== "unavailable" && player.state.kind !== "error";
  const cited = new Set(active?.segmentIds ?? []);
  const atLimit = cited.size >= MAX_CITED;
  const shown = q ? segments.filter((s) => s.text.toLowerCase().includes(q) || mmss(s.start_ms).startsWith(q)) : segments;

  // Opening the panel for a bullet scrolls to the first line it cites.
  const first = active?.segmentIds[0];
  const activeKey = active ? `${active.section}/${active.bullet}` : null;
  useEffect(() => {
    if (!activeKey || !first) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-cite-row="${first}"]`);
    // Scroll the list only (scrollIntoView would move the page too).
    if (list && el) list.scrollTop = Math.max(0, el.offsetTop - list.clientHeight / 3);
    // Only when the bullet changes, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-citation-panel>
      <div className="border-b border-slate/30 pb-3">
        <h2 className="t-subheading m-0">Transcript</h2>
        {active ? (
          <p className="t-small mt-1 mb-0" aria-live="polite">
            Choosing lines for {active.label}. {cited.size.toString()} of at most {MAX_CITED.toString()} chosen.
          </p>
        ) : (
          <p className="t-small mt-1 mb-0 text-slate">To change what a bullet cites, choose “Choose lines” under it, then tick the lines here.</p>
        )}
        {atLimit && active ? <p className="t-small mt-1 mb-0 text-slate">A bullet can cite at most {MAX_CITED.toString()} lines. Untick one to choose another.</p> : null}
        <SearchField value={query} onChange={setQuery} className="mt-3 flex flex-col gap-1">
          <Label className="t-small font-semibold">Find in the transcript</Label>
          <Input className="t-ui w-full rounded-[3px] border border-slate bg-sheet px-2 py-1.5" placeholder="Words or a time, e.g. 12:40" />
        </SearchField>
        {active ? (
          <button type="button" className="button mt-3" onClick={onDone}>
            Done choosing
          </button>
        ) : null}
      </div>
      <ol ref={listRef} className="relative m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 pt-2" aria-label="Transcript lines">
        {shown.length === 0 ? <li className="t-small py-3 text-slate">No line contains “{query.trim()}”.</li> : null}
        {shown.map((s) => {
          const isCited = cited.has(s.segment_id);
          return (
            <li key={s.segment_id} data-cite-row={s.segment_id} className={`grid grid-cols-[3.25rem_1fr] gap-x-2 border-l-[3px] py-1.5 pl-2 ${isCited ? "border-pen bg-pen-tint" : "border-transparent"}`}>
              <span className="t-small nums pt-0.5">
                {canPlay ? (
                  <button type="button" className="action" aria-label={`Play from ${mmss(s.start_ms)}`} onClick={() => { player.playFrom(s.start_ms); }}>
                    {mmss(s.start_ms)}
                  </button>
                ) : (
                  mmss(s.start_ms)
                )}
              </span>
              {active ? (
                <CheckboxField
                  isSelected={isCited}
                  isDisabled={!isCited && atLimit}
                  onChange={() => {
                    onToggle(s.segment_id);
                  }}
                >
                  <CheckboxButton className="group flex cursor-pointer items-start gap-2 data-[disabled]:cursor-not-allowed">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-slate bg-sheet text-sheet group-data-[selected]:border-pen group-data-[selected]:bg-pen group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-pen group-data-[disabled]:opacity-50"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  </span>
                  <span className="sr-only">Cite {mmss(s.start_ms)}: </span>
                  <LineText s={s} />
                  </CheckboxButton>
                </CheckboxField>
              ) : (
                <LineText s={s} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LineText({ s }: { s: Segment }) {
  return (
    <span className="t-small">
      <span className="font-semibold">{SPEAKER_LABEL[s.speaker]}</span> <span className="font-reading text-ink">{s.text}</span>
    </span>
  );
}
