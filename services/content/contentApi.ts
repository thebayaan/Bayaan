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

// The ticket endpoint answers 404 for a withdrawn or unknown key.
const TICKET_NOT_OFFERED = 'download_ticket_404';

// True when an install failed because the backend no longer offers the key,
// as opposed to a network or integrity failure.
export function isContentNotOffered(error: unknown): boolean {
  return error instanceof Error && error.message === TICKET_NOT_OFFERED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isMeta(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    isOptionalString(value.name) &&
    isOptionalString(value.language) &&
    (value.direction === undefined ||
      value.direction === 'ltr' ||
      value.direction === 'rtl')
  );
}

function isEntry(value: unknown): value is ManifestEntry {
  if (!isRecord(value)) return false;
  if (
    typeof value.key !== 'string' ||
    (value.kind !== 'tafsir' && value.kind !== 'translation') ||
    typeof value.version !== 'number' ||
    !(
      value.upstream_schema_version === undefined ||
      typeof value.upstream_schema_version === 'number'
    ) ||
    !isMeta(value.meta)
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

function isKnownKind(value: unknown): boolean {
  return (
    !isRecord(value) || value.kind === 'tafsir' || value.kind === 'translation'
  );
}

// Entries of a kind this build does not know are dropped, not fatal, so a new
// backend kind cannot invalidate the whole manifest.
function withKnownKinds(body: unknown): unknown {
  if (!isRecord(body) || !Array.isArray(body.resources)) return body;
  return {...body, resources: body.resources.filter(isKnownKind)};
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
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
        return await withTimeout<ManifestResult>(
          MANIFEST_TIMEOUT_MS,
          async signal => {
            const response = await fetchImpl(
              `${base}/v1/content/manifest?kinds=${kinds.join(',')}`,
              {
                headers: etag ? {...auth, 'If-None-Match': etag} : auth,
                signal,
              },
            );
            if (response.status === 304) return {status: 'not_modified'};
            if (!response.ok)
              return {status: 'error', reason: `http_${response.status}`};
            const body = withKnownKinds(parseJson(await response.text()));
            if (!isManifest(body))
              return {status: 'error', reason: 'malformed'};
            return {
              status: 'ok',
              manifest: body,
              etag: response.headers.get('ETag'),
            };
          },
        );
      } catch {
        return {status: 'error', reason: 'network'};
      }
    },
    async getDownloadTicket(key) {
      return withTimeout(MANIFEST_TIMEOUT_MS, async signal => {
        const response = await fetchImpl(
          `${base}/v1/content/resources/${encodeURIComponent(key)}/download`,
          {
            headers: auth,
            signal,
          },
        );
        if (response.status === 404) throw new Error(TICKET_NOT_OFFERED);
        if (!response.ok) throw new Error(`download_ticket_${response.status}`);
        const body = parseJson(await response.text());
        if (!isRecord(body) || !isTicket(body.data))
          throw new Error('download_ticket_malformed');
        return body.data;
      });
    },
    async fetchText(url) {
      // The R2 object carries Content-Encoding: gzip; the native HTTP stack decompresses it.
      return withTimeout(DOWNLOAD_TIMEOUT_MS, async signal => {
        const response = await fetchImpl(url, {signal});
        if (!response.ok) throw new Error(`download_${response.status}`);
        return response.text();
      });
    },
  };
}
