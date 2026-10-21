import createClient from "openapi-fetch";
import type { components, paths } from "./schema.gen";

export type Schemas = components["schemas"];

// Same-origin by default: the Vite dev server proxies /api to the API (vite.config.ts).
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export const api = createClient<paths>({ baseUrl: API_BASE });

export interface FieldProblem {
  loc: readonly (string | number)[];
  msg: string;
  type: string;
}

/** Every API failure, normalised from `{"error": {code, message, fields?}}`. The API never
 *  echoes request values, so `message` is safe to show; it is never logged. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: readonly FieldProblem[];

  constructor(status: number, code: string, message: string, fields: readonly FieldProblem[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseFields(v: unknown): FieldProblem[] {
  if (!Array.isArray(v)) return [];
  const out: FieldProblem[] = [];
  for (const item of v as unknown[]) {
    if (!isRecord(item) || !Array.isArray(item.loc)) continue;
    const loc = (item.loc as unknown[]).filter((p): p is string | number => typeof p === "string" || typeof p === "number");
    out.push({ loc, msg: typeof item.msg === "string" ? item.msg : "", type: typeof item.type === "string" ? item.type : "" });
  }
  return out;
}

export function toApiError(status: number, body: unknown): ApiError {
  const err = isRecord(body) && isRecord(body.error) ? body.error : null;
  if (err && typeof err.code === "string") {
    return new ApiError(status, err.code, typeof err.message === "string" ? err.message : "", parseFields(err.fields));
  }
  return new ApiError(status, status >= 500 ? "internal_error" : "unknown", "");
}

interface FetchResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/** Returns the data or throws ApiError, so TanStack Query sees one error type. */
export async function unwrap<R extends FetchResult>(p: Promise<R>): Promise<NonNullable<R["data"]>> {
  let result: R;
  try {
    result = await p;
  } catch {
    throw new ApiError(0, "network_error", "");
  }
  if (result.response.ok) return result.data as NonNullable<R["data"]>;
  throw toApiError(result.response.status, result.error);
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}
