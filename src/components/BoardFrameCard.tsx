import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/api/client";
import type { BoardFrame } from "~/analysis/types.gen";
import { mmss } from "~/lib/format";

const KIND_LABEL: Readonly<Record<BoardFrame["kind"], string>> = {
  board: "Board",
  slide: "Slide",
  screen: "Screen",
  camera: "Camera",
  other: "Screen",
};

/** True once the element has come near the viewport (then stays true). */
function useNearView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  // Without IntersectionObserver (old browsers, tests) everything counts as near.
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true);
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [near]);
  return [ref, near];
}

/** The frame image, fetched with the session (images need the same access as the analysis)
 *  only when the card nears the screen. */
function useFrameImage(lectureId: string, image: string | null | undefined, enabled: boolean) {
  const q = useQuery({
    queryKey: ["lecture", lectureId, "board", image],
    enabled: enabled && !!image,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const r = await api.GET("/lectures/{lecture_id}/board/{image}", {
        params: { path: { lecture_id: lectureId, image: image ?? "" } },
        parseAs: "blob",
      });
      if (!r.response.ok || !(r.data instanceof Blob)) throw new Error(String(r.response.status));
      return r.data;
    },
  });
  const url = useMemo(() => (q.data ? URL.createObjectURL(q.data) : null), [q.data]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return { url, failed: q.isError };
}

/** One page of the board or screen in the transcript: what was read from it, and the frame. */
export function BoardFrameCard({ lectureId, frame }: { lectureId: string; frame: BoardFrame }) {
  const [ref, near] = useNearView<HTMLDivElement>();
  const { url, failed } = useFrameImage(lectureId, frame.image, near);
  const label = KIND_LABEL[frame.kind];
  return (
    <div ref={ref} className="my-3 border-l-[3px] border-slate/50 bg-desk py-3 pl-3 pr-3" data-board-frame={frame.frame_id}>
      <p className="t-small m-0 font-semibold text-ink">
        {label}, {mmss(frame.start_ms) === mmss(frame.time_ms) ? mmss(frame.time_ms) : `${mmss(frame.start_ms)}–${mmss(frame.time_ms)}`}.{" "}
        <span className="font-normal text-slate">Read from the video; the reading can contain mistakes.</span>
      </p>
      <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <p className="t-transcript m-0 whitespace-pre-line">{frame.content}</p>
        {frame.image ? (
          url ? (
            <a href={url} target="_blank" rel="noreferrer" className="block self-start" aria-label={`Open the ${label.toLowerCase()} frame at ${mmss(frame.time_ms)} full size`}>
              <img src={url} alt="" className="w-full rounded-[2px] border border-slate/25" />
            </a>
          ) : (
            <p className="t-small m-0 self-start text-slate">{failed ? "The frame image isn't available." : "Loading the frame…"}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
