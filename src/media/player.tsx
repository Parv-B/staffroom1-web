import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Label, Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { api, isApiError, unwrap, type ApiError } from "~/api/client";
import { mmss } from "~/lib/format";

interface MediaUrl {
  url: string;
  expiresAt: number; // epoch ms, with a safety margin
  isVideo: boolean; // a video recording: shown in the video dock
}

// Renew a little before the URL actually expires, so a seek never races the deadline.
const EXPIRY_MARGIN_MS = 60_000;

function mediaQueryKey(lectureId: string) {
  return ["lecture", lectureId, "media"] as const;
}

async function fetchMediaUrl(lectureId: string): Promise<MediaUrl> {
  const out = await unwrap(api.GET("/lectures/{lecture_id}/media", { params: { path: { lecture_id: lectureId } } }));
  return {
    url: out.url,
    expiresAt: Date.now() + out.expires_in * 1000 - EXPIRY_MARGIN_MS,
    isVideo: (out.content_type ?? "").startsWith("video/"),
  };
}

type PlayerState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

export interface PlayerApi {
  state: PlayerState;
  playing: boolean;
  currentMs: number;
  durationMs: number;
  /** Seek to a moment and play. The rest of the page calls this from evidence links. */
  playFrom: (ms: number) => void;
  toggle: () => void;
  seek: (ms: number) => void;
  /** The recording is a video: its picture shows in the video dock (unless hidden). */
  isVideo: boolean;
  videoShown: boolean;
  setVideoShown: (shown: boolean) => void;
}

// Per-viewer convenience: whether the video dock was hidden last time.
const HIDE_KEY = "staffroom.videoHidden";
function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDE_KEY, hidden ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

// Pages that show the player bar register here, so the video dock only floats over them.
const DockContext = createContext<((delta: number) => void) | null>(null);

// Exported for tests, which supply a fake player.
export const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi | null {
  return use(PlayerContext);
}

function unavailableMessage(e: ApiError): string | null {
  switch (e.code) {
    case "media_deleted":
      return "The recording was removed under the centre's retention policy. The transcript and its timestamps are still here.";
    case "media_missing":
      return "The recording file can't be found in storage. The transcript and its timestamps are still here.";
    case "no_media":
      return "This lecture has no recording to play.";
    default:
      return null;
  }
}

export function PlayerProvider({ lectureId, durationMs, children }: { lectureId: string; durationMs: number; children: ReactNode }) {
  const audioRef = useRef<HTMLMediaElement | null>(null);
  const queryClient = useQueryClient();
  const media = useQuery({
    queryKey: mediaQueryKey(lectureId),
    queryFn: () => fetchMediaUrl(lectureId),
    staleTime: (q) => Math.max(0, (q.state.data?.expiresAt ?? 0) - Date.now()),
    refetchOnWindowFocus: false,
    retry: (n, e) => !(isApiError(e) && unavailableMessage(e) !== null) && n < 2,
  });
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const pending = useRef<{ ms: number; play: boolean } | null>(null);
  const refreshedFor = useRef<string | null>(null);
  const [hidden, setHidden] = useState(readHidden);
  const [bars, setBars] = useState(0);
  const isVideo = media.data?.isVideo ?? false;
  const videoShown = isVideo && !hidden;
  const setVideoShown = useCallback((shown: boolean) => {
    setHidden(!shown);
    writeHidden(!shown);
  }, []);
  const registerBar = useCallback((delta: number) => {
    setBars((n) => n + delta);
  }, []);

  const freshUrl = useCallback(async (): Promise<MediaUrl> => {
    const cached = queryClient.getQueryData<MediaUrl>(mediaQueryKey(lectureId));
    if (cached && cached.expiresAt > Date.now()) return cached;
    return queryClient.query({ queryKey: mediaQueryKey(lectureId), queryFn: () => fetchMediaUrl(lectureId), staleTime: 0 });
  }, [queryClient, lectureId]);

  const apply = useCallback((ms: number, play: boolean) => {
    const a = audioRef.current;
    if (!a) return;
    if (a.readyState >= HTMLMediaElement.HAVE_METADATA) {
      a.currentTime = ms / 1000;
      setCurrentMs(ms);
      if (play) void a.play().catch(() => undefined);
    } else {
      pending.current = { ms, play };
    }
  }, []);

  const seekTo = useCallback(
    (ms: number, play: boolean) => {
      const a = audioRef.current;
      if (!a) return;
      void freshUrl()
        .then((m) => {
          if (a.src !== m.url) {
            pending.current = { ms, play };
            a.src = m.url;
            a.load();
          } else {
            apply(ms, play);
          }
        })
        .catch(() => undefined);
    },
    [apply, freshUrl],
  );

  // The first URL: attach it without autoplay.
  useEffect(() => {
    const a = audioRef.current;
    if (a && media.data && !a.src) a.src = media.data.url;
  }, [media.data]);

  const onError = useCallback(() => {
    // An expired presigned URL makes S3 answer 403, which surfaces here. Renew once per URL and
    // resume from the same moment.
    const a = audioRef.current;
    if (!a || refreshedFor.current === a.src) return;
    refreshedFor.current = a.src;
    const at = a.currentTime * 1000;
    const wasPlaying = !a.paused;
    void queryClient.invalidateQueries({ queryKey: mediaQueryKey(lectureId) }).then(() => {
      seekTo(at, wasPlaying);
    });
  }, [queryClient, lectureId, seekTo]);

  const state: PlayerState = useMemo(() => {
    if (media.isPending) return { kind: "loading" };
    if (media.isError) {
      const msg = isApiError(media.error) ? unavailableMessage(media.error) : null;
      return msg
        ? { kind: "unavailable", message: msg }
        : { kind: "error", message: "The recording couldn't be loaded. Check your connection, then reload the page." };
    }
    return { kind: "ready" };
  }, [media.isPending, media.isError, media.error]);

  // Stable actions: pages hold on to these, so they must not change with every time update.
  const playFrom = useCallback((ms: number) => {
    seekTo(ms, true);
  }, [seekTo]);
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) seekTo(a.currentTime * 1000, true);
    else a.pause();
  }, [seekTo]);
  const seek = useCallback((ms: number) => {
    seekTo(ms, !(audioRef.current?.paused ?? true));
  }, [seekTo]);

  const value = useMemo<PlayerApi>(
    () => ({ state, playing, currentMs, durationMs, playFrom, toggle, seek, isVideo, videoShown, setVideoShown }),
    [state, playing, currentMs, durationMs, playFrom, toggle, seek, isVideo, videoShown, setVideoShown],
  );

  const docked = videoShown && bars > 0;
  useEffect(() => {
    // Phones: the dock covers the bottom of the page, so the page makes room for it.
    document.documentElement.classList.toggle("video-docked", docked);
    return () => {
      document.documentElement.classList.remove("video-docked");
    };
  }, [docked]);

  // One media element for the whole lecture, so playback carries on across its pages. A video
  // recording plays in a <video> that lives in the dock (hidden: the sound keeps playing).
  const MediaTag = isVideo ? "video" : "audio";
  const element = (
    <MediaTag
        ref={(el: HTMLMediaElement | null) => {
          audioRef.current = el;
        }}
        className={isVideo ? "block aspect-video w-full bg-ink" : undefined}
        playsInline
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onTimeUpdate={(e) => {
          setCurrentMs(e.currentTarget.currentTime * 1000);
        }}
        onLoadedMetadata={() => {
          const p = pending.current;
          pending.current = null;
          if (p) apply(p.ms, p.play);
        }}
        onError={onError}
      />
  );

  return (
    <PlayerContext value={value}>
      <DockContext value={registerBar}>
        {isVideo ? (
          <VideoDock shown={docked} onHide={() => { setVideoShown(false); }}>
            {element}
          </VideoDock>
        ) : (
          element
        )}
        {children}
      </DockContext>
    </PlayerContext>
  );
}

/** The video picture, pinned to the corner of the page (a strip along the bottom on phones).
 *  The bar above the page still holds play, seek and time. */
function VideoDock({ shown, onHide, children }: { shown: boolean; onHide: () => void; children: ReactNode }) {
  return (
    <section
      className="video-dock"
      aria-label="Video of the recording"
      hidden={!shown}
      data-no-print
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="t-small text-sheet">Recording</span>
        <Button className="t-small text-sheet underline" onPress={onHide}>
          Hide video
        </Button>
      </div>
      {children}
    </section>
  );
}

/** The docked player bar. Sticky at the top of the reading column, in normal flow. */
export function PlayerBar() {
  const p = usePlayer();
  const register = use(DockContext);
  useEffect(() => {
    if (!register) return;
    register(1);
    return () => {
      register(-1);
    };
  }, [register]);
  if (!p) return null;
  if (p.state.kind === "unavailable" || p.state.kind === "error") {
    return (
      <div className="t-small sticky top-0 z-10 bg-sheet py-3 text-slate" role="status" data-no-print>
        {p.state.message}
      </div>
    );
  }
  const disabled = p.state.kind !== "ready";
  return (
    <div
      className="sticky top-0 z-10 flex min-h-[var(--player-height)] items-center gap-3 bg-sheet py-2"
      data-no-print
      aria-label="Recording"
      role="region"
    >
      <Button
        className="button nums min-w-[5.5rem]"
        data-variant="primary"
        isDisabled={disabled}
        onPress={p.toggle}
        aria-label={p.playing ? "Pause recording" : "Play recording"}
      >
        {p.playing ? "Pause" : "Play"}
      </Button>
      <Button
        className="button"
        isDisabled={disabled}
        onPress={() => {
          p.seek(Math.max(0, p.currentMs - 5000));
        }}
      >
        Back 5 s
      </Button>
      <Slider
        className="flex min-w-0 flex-1 items-center gap-3"
        minValue={0}
        maxValue={Math.floor(p.durationMs / 1000)}
        step={1}
        value={Math.min(Math.floor(p.currentMs / 1000), Math.floor(p.durationMs / 1000))}
        formatOptions={{ style: "unit", unit: "second", unitDisplay: "long" }}
        isDisabled={disabled}
        onChange={(v) => {
          p.seek(v * 1000);
        }}
        aria-label="Position in recording"
      >
        <Label className="sr-only">Position in recording</Label>
        <SliderTrack className="relative h-6 flex-1">
          {({ state }) => (
            <>
              <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 bg-slate/40" />
              <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-pen" style={{ width: `${(state.getThumbPercent(0) * 100).toString()}%` }} />
              <SliderThumb className="top-1/2 size-4 rounded-full border-2 border-sheet bg-pen" />
            </>
          )}
        </SliderTrack>
      </Slider>
      <span className="t-small nums shrink-0 text-slate" aria-hidden="true">
        {mmss(p.currentMs)} / {mmss(p.durationMs)}
      </span>
      {p.isVideo ? (
        <Button
          // Phones: the dock has its own Hide button and the bar has no room, so the bar only
          // offers to bring a hidden video back.
          className={`button shrink-0 ${p.videoShown ? "max-sm:hidden" : ""}`}
          onPress={() => {
            p.setVideoShown(!p.videoShown);
          }}
        >
          {p.videoShown ? "Hide video" : "Show video"}
        </Button>
      ) : null}
    </div>
  );
}
