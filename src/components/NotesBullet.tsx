import type { Segment } from "~/analysis/types.gen";
import { mmss } from "~/lib/format";
import { usePlayer } from "~/media/player";
import { SPEAKER_LABEL } from "./TranscriptLines";

/** A notes bullet with the transcript moments it cites, always visible; the cited text opens
 *  beneath it. Missing segments are said out loud, never dropped. */
export function NotesBullet({ bullet, segmentsById }: { bullet: { readonly text: string; readonly segment_ids: readonly string[] }; segmentsById: ReadonlyMap<string, Segment> }) {
  const player = usePlayer();
  const canPlay = player !== null && player.state.kind !== "unavailable" && player.state.kind !== "error";
  const cited = bullet.segment_ids.map((id) => ({ id, s: segmentsById.get(id) }));
  return (
    <li className="measure">
      <p className="t-reading m-0">{bullet.text}</p>
      <p className="t-small nums mt-1 flex flex-wrap gap-x-3 text-slate">
        <span>Said at</span>
        {cited.map(({ id, s }) =>
          !s ? (
            <span key={id} className="text-lagoon">
              {id} (no longer in the transcript)
            </span>
          ) : canPlay ? (
            <button
              key={id}
              type="button"
              className="action"
              aria-label={`Play from ${mmss(s.start_ms)}`}
              onClick={() => {
                player.playFrom(s.start_ms);
              }}
            >
              {mmss(s.start_ms)}
            </button>
          ) : (
            <span key={id}>{mmss(s.start_ms)}</span>
          ),
        )}
      </p>
      <details className="t-small mt-1 text-slate">
        <summary className="action w-fit">Show what was said</summary>
        <ul className="mt-2 list-none space-y-1.5 border-l-[3px] border-pen/40 p-0 pl-3">
          {cited.map(({ id, s }) =>
            s ? (
              <li key={id} className="grid grid-cols-[3.25rem_1fr] gap-x-3">
                <span className="nums">{mmss(s.start_ms)}</span>
                <span>
                  <span className="font-semibold">{SPEAKER_LABEL[s.speaker]}</span>{" "}
                  <span className="font-reading text-ink">{s.text}</span>
                </span>
              </li>
            ) : null,
          )}
        </ul>
      </details>
    </li>
  );
}
