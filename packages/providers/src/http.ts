/**
 * Minimal HTTP surface the vendor providers depend on, so transports are injectable
 * and unit-tested with no live calls (CLAUDE.md §8 / DoD). The default delegates to
 * the Node 18+ global fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface HttpRequestInit {
  method: string;
  headers?: Record<string, string>;
  /** string | FormData | Uint8Array — providers pass what each vendor needs */
  body?: unknown;
}

export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponse>;

export const defaultFetch: FetchLike = (url, init) =>
  fetch(url, init as RequestInit) as unknown as Promise<HttpResponse>;
