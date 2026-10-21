import { api, isApiError, unwrap, type Schemas } from "~/api/client";
import { PutError, xhrPut, type PutFn } from "./transport";
import { fingerprint, indexedDbStore, recordKey, sameFile, type UploadRecord, type UploadStore } from "./store";

export const PARALLEL_PARTS = 4;
const MAX_ATTEMPTS = 6;

export interface UploadApi {
  create(body: Schemas["UploadIn"]): Promise<Schemas["UploadOut"]>;
  signParts(uploadId: string, partNumbers: number[]): Promise<Schemas["PartsOut"]>;
  complete(uploadId: string, parts: Schemas["CompletedPart"][]): Promise<Schemas["UploadStatusOut"]>;
  abort(uploadId: string): Promise<Schemas["UploadStatusOut"]>;
}

export const httpUploadApi: UploadApi = {
  create: (body) => unwrap(api.POST("/uploads", { body })),
  signParts: (id, part_numbers) => unwrap(api.POST("/uploads/{upload_id}/parts", { params: { path: { upload_id: id } }, body: { part_numbers } })),
  complete: (id, parts) => unwrap(api.POST("/uploads/{upload_id}/complete", { params: { path: { upload_id: id } }, body: { parts } })),
  abort: (id) => unwrap(api.POST("/uploads/{upload_id}/abort", { params: { path: { upload_id: id } } })),
};

export interface UploadDeps {
  api: UploadApi;
  put: PutFn;
  store: UploadStore;
  /** Waits before a retry; replaced in tests. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}

export const defaultDeps: UploadDeps = {
  api: httpUploadApi,
  put: xhrPut,
  store: indexedDbStore,
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new PutError("aborted", 0));
      }, { once: true });
    }),
};

export interface Progress {
  sentBytes: number;
  totalBytes: number;
  partsDone: number;
  partCount: number;
  /** True while waiting to retry after a dropped connection. */
  retrying: boolean;
}

export type UploadFailure =
  | "unsupported_type"
  | "too_large"
  | "etag_missing"
  | "storage_rejected"
  | "stalled"
  | "upload_gone"
  | "other";

export class UploadError extends Error {
  readonly kind: UploadFailure;
  constructor(kind: UploadFailure, message: string) {
    super(message);
    this.name = "UploadError";
    this.kind = kind;
  }
}

const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  weba: "audio/webm",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

/** The content type to declare: the browser's if it is audio/video, else from the extension. */
export function contentTypeFor(file: { name: string; type: string }): string | null {
  if (/^(audio|video)\//.test(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

export function missingParts(rec: Pick<UploadRecord, "partCount" | "etags">): number[] {
  const out: number[] = [];
  for (let n = 1; n <= (rec.partCount ?? 0); n++) if (!rec.etags[n]) out.push(n);
  return out;
}

/** Finds a saved, unfinished upload by this user for the same file (name, size, modified). */
export async function findResumable(file: File, userId: string, store: UploadStore = indexedDbStore): Promise<UploadRecord | undefined> {
  const fp = fingerprint(file);
  const recs = await store.listForUser(userId);
  return recs.find((r) => r.state === "uploading" && r.mode === "multipart" && sameFile(r.file, fp));
}

interface RunOptions {
  file: File;
  userId: string;
  /** A saved record for this file, to resume instead of starting over. */
  resume?: UploadRecord;
  onRecord?: (rec: UploadRecord) => void;
  onProgress: (p: Progress) => void;
  signal: AbortSignal;
  deps?: UploadDeps;
}

/** Uploads the file straight to object storage and completes it. Returns the finished record.
 *  Abort the signal to pause: finished parts stay saved and a later run resumes them. */
export async function runUpload(opts: RunOptions): Promise<UploadRecord> {
  const deps = opts.deps ?? defaultDeps;
  const { file, signal } = opts;
  let rec: UploadRecord;
  let urls = new Map<number, string>();
  let singleUrl: { url: string; headers: Record<string, string> } | null = null;

  if (opts.resume && sameFile(opts.resume.file, fingerprint(file))) {
    rec = opts.resume;
    const missing = missingParts(rec);
    if (missing.length > 0) {
      try {
        // Only the parts not yet stored are signed again.
        const signed = await deps.api.signParts(rec.uploadId, missing);
        urls = new Map(signed.parts.map((p) => [p.part_number, p.url]));
      } catch (e) {
        if (isApiError(e) && (e.status === 404 || e.status === 409)) {
          await deps.store.remove(rec.key);
          throw new UploadError("upload_gone", "The earlier upload can no longer be continued. Start it again with the same file.");
        }
        throw e;
      }
    }
  } else {
    const contentType = contentTypeFor(file);
    if (!contentType) throw new UploadError("unsupported_type", "This doesn't look like an audio or video file. Choose the class recording (for example an MP3, M4A or MP4).");
    let out: Schemas["UploadOut"];
    try {
      out = await deps.api.create({ filename: file.name, content_type: contentType, size_bytes: file.size });
    } catch (e) {
      if (isApiError(e, "too_large")) throw new UploadError("too_large", "This file is larger than Staffroom1 accepts (5 GB). Export the recording at a lower quality and try again.");
      if (isApiError(e, "unsupported_media_type")) throw new UploadError("unsupported_type", "Only audio and video recordings can be uploaded.");
      throw e;
    }
    const now = Date.now();
    rec = {
      key: recordKey(opts.userId, out.upload_id),
      userId: opts.userId,
      uploadId: out.upload_id,
      mode: out.mode === "multipart" ? "multipart" : "single",
      file: fingerprint(file),
      contentType,
      partSize: out.part_size ?? null,
      partCount: out.part_count ?? null,
      etags: {},
      state: "uploading",
      createdAt: now,
      updatedAt: now,
    };
    if (rec.mode === "multipart") urls = new Map(out.parts.map((p) => [p.part_number, p.url]));
    else if (out.url) singleUrl = { url: out.url, headers: { ...out.headers } };
    // Single PUTs can't resume (one request), so only multipart uploads are saved.
    if (rec.mode === "multipart") await deps.store.put(rec);
  }
  opts.onRecord?.(rec);

  if (rec.mode === "single") {
    if (!singleUrl) throw new UploadError("upload_gone", "The upload link is missing. Start the upload again.");
    const target = singleUrl;
    opts.onProgress({ sentBytes: 0, totalBytes: file.size, partsDone: 0, partCount: 1, retrying: false });
    await withRetries(deps, signal, () => deps.put(target.url, file, target.headers, (n) => {
      opts.onProgress({ sentBytes: n, totalBytes: file.size, partsDone: 0, partCount: 1, retrying: false });
    }, signal), () => Promise.reject(new UploadError("upload_gone", "The upload link expired. Start the upload again.")), () => {
      opts.onProgress({ sentBytes: 0, totalBytes: file.size, partsDone: 0, partCount: 1, retrying: true });
    });
    await complete(deps, rec, []);
  } else {
    await uploadParts(deps, rec, file, urls, opts.onProgress, signal);
    const parts = Object.entries(rec.etags)
      .map(([n, etag]) => ({ part_number: Number(n), etag }))
      .sort((a, b) => a.part_number - b.part_number);
    await complete(deps, rec, parts);
  }
  rec = { ...rec, state: "completed", updatedAt: Date.now() };
  await deps.store.put(rec);
  opts.onRecord?.(rec);
  return rec;
}

async function uploadParts(
  deps: UploadDeps,
  rec: UploadRecord,
  file: File,
  urls: Map<number, string>,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<void> {
  const partSize = rec.partSize ?? 0;
  const partCount = rec.partCount ?? 0;
  const queue = missingParts(rec);
  const inFlight = new Map<number, number>();
  let retrying = false;
  const doneBytes = () => Object.keys(rec.etags).reduce((sum, n) => sum + Math.min(partSize, file.size - (Number(n) - 1) * partSize), 0);
  const report = () => {
    let sent = doneBytes();
    for (const v of inFlight.values()) sent += v;
    onProgress({ sentBytes: Math.min(sent, file.size), totalBytes: file.size, partsDone: Object.keys(rec.etags).length, partCount, retrying });
  };
  report();

  const worker = async () => {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
      const partNumber = n;
      const blob = file.slice((partNumber - 1) * partSize, Math.min(file.size, partNumber * partSize));
      const { etag } = await withRetries(
        deps,
        signal,
        () => {
          const url = urls.get(partNumber);
          if (!url) throw new PutError("expired", 403);
          inFlight.set(partNumber, 0);
          return deps.put(url, blob, {}, (loaded) => {
            inFlight.set(partNumber, loaded);
            report();
          }, signal);
        },
        async () => {
          const signed = await deps.api.signParts(rec.uploadId, [partNumber]);
          for (const p of signed.parts) urls.set(p.part_number, p.url);
        },
        () => {
          inFlight.set(partNumber, 0);
          retrying = true;
          report();
        },
      );
      inFlight.delete(partNumber);
      if (!etag) throw new UploadError("etag_missing", "The storage server didn't return the part's checksum (ETag). Ask an admin to check the bucket's CORS settings.");
      rec.etags = { ...rec.etags, [partNumber]: etag };
      rec.updatedAt = Date.now();
      retrying = false;
      await deps.store.put(rec);
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, queue.length) }, worker));
}

/** Retries network failures with backoff (waiting for the browser to come back online) and
 *  re-signs once per expiry. Aborts propagate immediately. */
async function withRetries<T>(
  deps: UploadDeps,
  signal: AbortSignal,
  attempt: () => Promise<T>,
  resign: () => Promise<void>,
  onRetry: () => void,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await attempt();
    } catch (e) {
      if (!(e instanceof PutError) || e.kind === "aborted" || signal.aborted) throw e;
      if (i >= MAX_ATTEMPTS) throw new UploadError("stalled", "The upload stopped after several failed attempts. Check your connection, then select the same file to continue where it stopped.");
      onRetry();
      if (e.kind === "expired") await resign();
      else {
        if (typeof navigator !== "undefined" && !navigator.onLine) await waitForOnline(signal);
        await deps.sleep(Math.min(30_000, 1000 * 2 ** (i - 1)), signal);
      }
    }
  }
}

function waitForOnline(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener("online", done);
      resolve();
    };
    window.addEventListener("online", done);
    signal.addEventListener("abort", () => {
      window.removeEventListener("online", done);
      reject(new PutError("aborted", 0));
    }, { once: true });
  });
}

async function complete(deps: UploadDeps, rec: UploadRecord, parts: Schemas["CompletedPart"][]): Promise<void> {
  try {
    await deps.api.complete(rec.uploadId, parts);
  } catch (e) {
    if (isApiError(e, "complete_failed") || isApiError(e, "size_mismatch") || isApiError(e, "object_missing")) {
      await deps.store.remove(rec.key);
      throw new UploadError("storage_rejected", "The storage server didn't accept the finished file. Start the upload again.");
    }
    if (isApiError(e) && (e.status === 404 || isApiError(e, "upload_not_open"))) {
      await deps.store.remove(rec.key);
      throw new UploadError("upload_gone", "This upload was cancelled or has expired. Start it again.");
    }
    throw e;
  }
}

/** Cancels an upload for good: aborts it on the server and forgets it locally. */
export async function discardUpload(rec: UploadRecord, deps: UploadDeps = defaultDeps): Promise<void> {
  try {
    if (rec.state === "uploading" && rec.mode === "multipart") await deps.api.abort(rec.uploadId);
  } catch {
    // Already aborted or completed: nothing left to clean up on the server.
  }
  await deps.store.remove(rec.key);
}
