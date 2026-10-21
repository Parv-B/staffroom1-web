// PUTs a blob to a presigned S3 URL with XMLHttpRequest, because fetch can't report upload
// progress. Resolves with the ETag header (the bucket's CORS exposes it).

export type PutFailure = "expired" | "network" | "aborted" | "server";

export class PutError extends Error {
  readonly kind: PutFailure;
  readonly status: number;
  constructor(kind: PutFailure, status: number) {
    super(`upload request failed: ${kind} (${status.toString()})`);
    this.name = "PutError";
    this.kind = kind;
    this.status = status;
  }
}

export type PutFn = (
  url: string,
  body: Blob,
  headers: Readonly<Record<string, string>>,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
) => Promise<{ etag: string | null }>;

export const xhrPut: PutFn = (url, body, headers, onProgress, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new PutError("aborted", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ etag: xhr.getResponseHeader("ETag") });
      // S3 answers 403 when a presigned URL has expired (or its signature no longer matches).
      else reject(new PutError(xhr.status === 403 ? "expired" : "server", xhr.status));
    };
    xhr.onerror = () => {
      reject(new PutError("network", 0));
    };
    xhr.onabort = () => {
      reject(new PutError("aborted", 0));
    };
    signal.addEventListener("abort", () => {
      xhr.abort();
    }, { once: true });
    xhr.send(body);
  });
