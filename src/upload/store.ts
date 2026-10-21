// Upload state persisted in IndexedDB, per user and per upload, so a multipart upload can be
// resumed after a refresh: the record keeps each finished part's ETag. Only the file's name,
// size, type and modified time are kept (to recognise the same file again), never its bytes.

export interface FileFingerprint {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface MetadataDraft {
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  class_type: "online" | "in_person" | "";
  class_composition: "co_ed" | "girls" | "boys" | "unknown";
  lesson_plan: string;
  objectives: string;
  teacher_user_id: string;
}

export interface UploadRecord {
  key: string; // `${userId}:${uploadId}`
  userId: string;
  uploadId: string;
  mode: "single" | "multipart";
  file: FileFingerprint;
  contentType: string;
  partSize: number | null;
  partCount: number | null;
  /** part number → ETag exactly as S3 returned it (quotes included). */
  etags: Record<number, string>;
  state: "uploading" | "completed";
  createdAt: number;
  updatedAt: number;
  draft?: MetadataDraft;
  /** Which fields the teacher touched and which hold AI suggestions (src/lectures/suggest.ts). */
  assist?: import("~/lectures/suggest").FormAssist;
}

export interface UploadStore {
  get(key: string): Promise<UploadRecord | undefined>;
  put(rec: UploadRecord): Promise<void>;
  remove(key: string): Promise<void>;
  listForUser(userId: string): Promise<UploadRecord[]>;
}

export function recordKey(userId: string, uploadId: string): string {
  return `${userId}:${uploadId}`;
}

export function fingerprint(f: File): FileFingerprint {
  return { name: f.name, size: f.size, type: f.type, lastModified: f.lastModified };
}

export function sameFile(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

const DB_NAME = "staffroom1-uploads";
const STORE = "uploads";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: "key" });
      s.createIndex("userId", "userId");
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IndexedDB unavailable"));
    };
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB transaction failed"));
        };
      }),
  );
}

export const indexedDbStore: UploadStore = {
  get: (key) => run<UploadRecord | undefined>("readonly", (s) => s.get(key) as IDBRequest<UploadRecord | undefined>),
  put: async (rec) => {
    await run("readwrite", (s) => s.put(rec));
  },
  remove: async (key) => {
    await run("readwrite", (s) => s.delete(key));
  },
  listForUser: (userId) => run<UploadRecord[]>("readonly", (s) => s.index("userId").getAll(userId) as IDBRequest<UploadRecord[]>),
};
