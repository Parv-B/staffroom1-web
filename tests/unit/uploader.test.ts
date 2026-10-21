import { describe, expect, it } from "vitest";
import { ApiError } from "~/api/client";
import { PutError, type PutFn } from "~/upload/transport";
import type { UploadRecord, UploadStore } from "~/upload/store";
import { UploadError, contentTypeFor, runUpload, type UploadApi, type UploadDeps } from "~/upload/uploader";

const MiB = 1024 * 1024;

function memoryStore(): UploadStore & { data: Map<string, UploadRecord> } {
  const data = new Map<string, UploadRecord>();
  return {
    data,
    get: (k) => Promise.resolve(data.get(k)),
    put: (r) => {
      data.set(r.key, structuredClone(r));
      return Promise.resolve();
    },
    remove: (k) => {
      data.delete(k);
      return Promise.resolve();
    },
    listForUser: (u) => Promise.resolve([...data.values()].filter((r) => r.userId === u)),
  };
}

function file(size: number): File {
  return new File([new Uint8Array(size)], "class.mp3", { type: "audio/mpeg", lastModified: 1_700_000_000_000 });
}

function fakeApi(partSize: number, calls: { signed: number[][]; completed: { part_number: number; etag: string }[][] }): UploadApi {
  return {
    create: (b) => {
      const n = Math.ceil(b.size_bytes / partSize);
      return Promise.resolve({
        upload_id: "up_1",
        kind: "media",
        mode: "multipart",
        expires_in: 3600,
        url: null,
        method: "PUT",
        headers: {},
        part_size: partSize,
        part_count: n,
        parts: Array.from({ length: n }, (_, i) => ({ part_number: i + 1, url: `https://s3/part/${(i + 1).toString()}` })),
      });
    },
    signParts: (id, nums) => {
      calls.signed.push(nums);
      return Promise.resolve({ upload_id: id, expires_in: 3600, parts: nums.map((n) => ({ part_number: n, url: `https://s3/part/${n.toString()}?fresh` })) });
    },
    complete: (id, parts) => {
      calls.completed.push(parts);
      return Promise.resolve({ upload_id: id, status: "completed", completed_at: null });
    },
    abort: (id) => Promise.resolve({ upload_id: id, status: "aborted", completed_at: null }),
  };
}

const noSleep: UploadDeps["sleep"] = () => Promise.resolve();
const okPut: PutFn = (url, body, _h, onProgress) => {
  onProgress(body.size);
  return Promise.resolve({ etag: `"etag-${url.split("/").pop()?.split("?")[0] ?? ""}"` });
};

describe("multipart upload", () => {
  it("uploads every part, keeps each ETag and completes with all parts in order", async () => {
    const calls = { signed: [] as number[][], completed: [] as { part_number: number; etag: string }[][] };
    const store = memoryStore();
    const done = await runUpload({ file: file(10 * MiB), userId: "u1", onProgress: () => undefined, signal: new AbortController().signal, deps: { api: fakeApi(3 * MiB, calls), put: okPut, store, sleep: noSleep } });
    expect(done.state).toBe("completed");
    expect(calls.completed[0]?.map((p) => p.part_number)).toEqual([1, 2, 3, 4]);
    expect(calls.completed[0]?.[0]?.etag).toBe('"etag-1"');
  });

  it("resumes after a refresh by re-signing only the parts that are missing", async () => {
    const calls = { signed: [] as number[][], completed: [] as { part_number: number; etag: string }[][] };
    const store = memoryStore();
    const deps: UploadDeps = { api: fakeApi(3 * MiB, calls), put: okPut, store, sleep: noSleep };
    const f = file(10 * MiB);
    // First run: part 3 never finishes, then the user leaves (abort).
    const ac = new AbortController();
    const stuck: PutFn = (url, body, h, p, signal) =>
      url.endsWith("/3")
        ? new Promise((_r, reject) => {
            signal.addEventListener("abort", () => {
              reject(new PutError("aborted", 0));
            });
          })
        : okPut(url, body, h, p, signal);
    const first = runUpload({ file: f, userId: "u1", onProgress: (p) => { if (p.partsDone === 3) ac.abort(); }, signal: ac.signal, deps: { ...deps, put: stuck } });
    await expect(first).rejects.toBeInstanceOf(PutError);
    const saved = [...store.data.values()][0];
    expect(saved && Object.keys(saved.etags).sort()).toEqual(["1", "2", "4"]);

    // After the refresh: the same file is selected again.
    const put: string[] = [];
    const tracking: PutFn = (url, ...rest) => {
      put.push(url);
      return okPut(url, ...rest);
    };
    if (!saved) throw new Error("no saved record");
    const done = await runUpload({ file: f, userId: "u1", resume: saved, onProgress: () => undefined, signal: new AbortController().signal, deps: { ...deps, put: tracking } });
    expect(calls.signed).toEqual([[3]]);
    expect(put).toEqual(["https://s3/part/3?fresh"]);
    expect(done.state).toBe("completed");
    expect(calls.completed[0]?.map((p) => p.part_number)).toEqual([1, 2, 3, 4]);
  });

  it("re-signs a part whose URL expired and retries a dropped connection", async () => {
    const calls = { signed: [] as number[][], completed: [] as { part_number: number; etag: string }[][] };
    let attempts = 0;
    const flaky: PutFn = (url, ...rest) => {
      attempts++;
      if (url.endsWith("/1")) return Promise.reject(new PutError("expired", 403));
      if (attempts === 2) return Promise.reject(new PutError("network", 0));
      return okPut(url, ...rest);
    };
    const done = await runUpload({ file: file(4 * MiB), userId: "u1", onProgress: () => undefined, signal: new AbortController().signal, deps: { api: fakeApi(3 * MiB, calls), put: flaky, store: memoryStore(), sleep: noSleep } });
    expect(calls.signed).toEqual([[1]]);
    expect(done.state).toBe("completed");
  });

  it("stops with a clear error when storage hides the ETag", async () => {
    const calls = { signed: [] as number[][], completed: [] as { part_number: number; etag: string }[][] };
    const noEtag: PutFn = () => Promise.resolve({ etag: null });
    await expect(
      runUpload({ file: file(4 * MiB), userId: "u1", onProgress: () => undefined, signal: new AbortController().signal, deps: { api: fakeApi(3 * MiB, calls), put: noEtag, store: memoryStore(), sleep: noSleep } }),
    ).rejects.toMatchObject({ kind: "etag_missing" });
    expect(calls.completed).toEqual([]);
  });

  it("forgets a saved upload the server no longer has", async () => {
    const calls = { signed: [] as number[][], completed: [] as { part_number: number; etag: string }[][] };
    const store = memoryStore();
    const api = { ...fakeApi(3 * MiB, calls), signParts: () => Promise.reject(new ApiError(409, "upload_not_open", "")) };
    const f = file(4 * MiB);
    const rec: UploadRecord = { key: "u1:up_1", userId: "u1", uploadId: "up_1", mode: "multipart", file: { name: f.name, size: f.size, type: f.type, lastModified: f.lastModified }, contentType: "audio/mpeg", partSize: 3 * MiB, partCount: 2, etags: { 1: '"a"' }, state: "uploading", createdAt: 0, updatedAt: 0 };
    await store.put(rec);
    await expect(runUpload({ file: f, userId: "u1", resume: rec, onProgress: () => undefined, signal: new AbortController().signal, deps: { api, put: okPut, store, sleep: noSleep } })).rejects.toBeInstanceOf(UploadError);
    expect(store.data.size).toBe(0);
  });
});

describe("content type", () => {
  it("uses the browser's audio/video type, else the extension, else refuses", () => {
    expect(contentTypeFor({ name: "a.mp3", type: "audio/mpeg" })).toBe("audio/mpeg");
    expect(contentTypeFor({ name: "class.M4A", type: "" })).toBe("audio/mp4");
    expect(contentTypeFor({ name: "notes.pdf", type: "application/pdf" })).toBeNull();
  });
});
