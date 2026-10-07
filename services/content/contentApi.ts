import branding from '@/config/branding';
import type {
  ContentKind,
  DownloadTicket,
  Manifest,
  ManifestEntry,
} from '@/types/content';

const MANIFEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export type ManifestResult =
  | {status: 'ok'; manifest: Manifest; etag: string | null}
  | {status: 'not_modified'}
  | {status: 'error'; reason: string};

export interface ContentApi {
  fetchManifest(
    kinds: ContentKind[],
    etag: string | null,
  ): Promise<ManifestResult>;
  getDownloadTicket(key: string): Promise<DownloadTicket>;
  fetchText(url: string): Promise<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is ManifestEntry {
  if (!isRecord(value)) return false;
  if (
    typeof value.key !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.version !== 'number'
  )
    return false;
  if (value.status === 'withdrawn') return true;
  return (
    value.status === 'active' &&
    typeof value.sha256 === 'string' &&
    typeof value.bytes === 'number'
  );
}

export function isManifest(value: unknown): value is Manifest {
  return (
    isRecord(value) &&
    value.format === 1 &&
    typeof value.paused === 'boolean' &&
    Array.isArray(value.resources) &&
    value.resources.every(isEntry)
  );
}

function isTicket(value: unknown): value is DownloadTicket {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.version === 'number' &&
    typeof value.sha256 === 'string' &&
    typeof value.bytes === 'number'
  );
}

async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function resolveContentApiBase(): string | null {
  const base =
    branding.contentApiBase ?? process.env.EXPO_PUBLIC_BAYAAN_API_URL;
  return base ? base.replace(/\/+$/, '') : null;
}

export function createContentApi(
  base: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): ContentApi {
  const auth = {Authorization: `Bearer ${apiKey}`};
  return {
    async fetchManifest(kinds, etag) {
      try {
        const response = await withTimeout(MANIFEST_TIMEOUT_MS, signal =>
          fetchImpl(`${base}/v1/content/manifest?kinds=${kinds.join(',')}`, {
            headers: etag ? {...auth, 'If-None-Match': etag} : auth,
            signal,
          }),
        );
        if (response.status === 304) return {status: 'not_modified'};
        if (!response.ok)
          return {status: 'error', reason: `http_${response.status}`};
        const body: unknown = await response.json();
        if (!isManifest(body)) return {status: 'error', reason: 'malformed'};
        return {
          status: 'ok',
          manifest: body,
          etag: response.headers.get('ETag'),
        };
      } catch {
        return {status: 'error', reason: 'network'};
      }
    },
    async getDownloadTicket(key) {
      const response = await withTimeout(MANIFEST_TIMEOUT_MS, signal =>
        fetchImpl(
          `${base}/v1/content/resources/${encodeURIComponent(key)}/download`,
          {headers: auth, signal},
        ),
      );
      if (!response.ok) throw new Error(`download_ticket_${response.status}`);
      const body: unknown = await response.json();
      if (!isRecord(body) || !isTicket(body.data))
        throw new Error('download_ticket_malformed');
      return body.data;
    },
    async fetchText(url) {
      // The R2 object carries Content-Encoding: gzip; the native HTTP stack decompresses it.
      const response = await withTimeout(DOWNLOAD_TIMEOUT_MS, signal =>
        fetchImpl(url, {signal}),
      );
      if (!response.ok) throw new Error(`download_${response.status}`);
      return response.text();
    },
  };
}
