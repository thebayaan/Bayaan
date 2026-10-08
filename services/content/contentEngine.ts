import type {ContentApi} from './contentApi';
import {emptyRow, type ContentRegistry} from './contentRegistry';
import type {
  ContentEnvelope,
  ContentInstaller,
  ContentKind,
  LocalContentRow,
  ManifestEntry,
  WithdrawalNotice,
} from '@/types/content';

export const DAY_MS = 86_400_000;
export const WIFI_THRESHOLD_BYTES = 5_000_000;
// Accepted: unforced checks run daily, so the 1h and 6h steps only shorten retries for forced checks and user installs.
export const BACKOFF_MS = [3_600_000, 21_600_000, 86_400_000];

export interface EngineDeps {
  api: ContentApi;
  registry: ContentRegistry;
  installers: Partial<Record<ContentKind, ContentInstaller>>;
  isOnWifi: () => Promise<boolean>;
  sha256: (text: string) => Promise<string>;
  now: () => number;
  notify: (notice: WithdrawalNotice) => void;
  track: (
    event: 'applied' | 'withdrawn' | 'failed',
    props: {key: string; version: number; reason?: string},
  ) => void;
}

export type CheckOutcome =
  | 'skipped_recent'
  | 'not_modified'
  | 'error'
  | 'paused'
  | 'applied';

function isEnvelope(value: unknown): value is ContentEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.envelope === 1 &&
    typeof candidate.key === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.snapshot === 'object' &&
    candidate.snapshot !== null
  );
}

function backoffFor(failures: number): number {
  return BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1];
}

function checkIsDue(lastCheckedAt: number | null, now: number): boolean {
  if (lastCheckedAt === null) return true;
  const gap = now - lastCheckedAt;
  // A negative gap means the clock moved backwards; treat the last check as stale.
  return gap < 0 || gap >= DAY_MS;
}

function retryIsDue(nextRetryAt: number | null, now: number): boolean {
  if (nextRetryAt === null || nextRetryAt <= now) return true;
  // Further out than the longest backoff means the clock moved backwards.
  return nextRetryAt - now > BACKOFF_MS[BACKOFF_MS.length - 1];
}

async function recordFailure(
  deps: EngineDeps,
  key: string,
  kind: ContentKind,
  reason: string,
): Promise<void> {
  const row = (await deps.registry.get(key)) ?? emptyRow(key, kind);
  const failures = row.failures + 1;
  await deps.registry.upsert({
    ...row,
    failures,
    next_retry_at: deps.now() + backoffFor(failures),
  });
  deps.track('failed', {key, version: row.version, reason});
}

export async function installResource(
  deps: EngineDeps,
  key: string,
  kind: ContentKind,
  reason: 'user' | 'auto',
  expectedVersion?: number,
): Promise<void> {
  const installer = deps.installers[kind];
  if (!installer) throw new Error(`no_installer_${kind}`);
  try {
    const ticket = await deps.api.getDownloadTicket(key);
    const text = await deps.api.fetchText(ticket.url);
    if ((await deps.sha256(text)) !== ticket.sha256)
      throw new Error('sha_mismatch');
    const parsed: unknown = JSON.parse(text);
    if (!isEnvelope(parsed) || parsed.key !== key)
      throw new Error('envelope_mismatch');
    if (
      parsed.version !== ticket.version ||
      (expectedVersion !== undefined && ticket.version !== expectedVersion)
    )
      throw new Error('version_mismatch');
    if (!installer.supportsSchemaVersion(parsed.snapshot.schema_version))
      throw new Error('unsupported_schema');
    const previous = (await deps.registry.get(key)) ?? emptyRow(key, kind);
    await installer.install(key, parsed, undefined);
    await deps.registry.upsert({
      ...previous,
      version: ticket.version,
      sha256: ticket.sha256,
      upstream_schema_version: parsed.snapshot.schema_version,
      installed_at: deps.now(),
      legacy: false,
      user_removed: false,
      failures: 0,
      next_retry_at: null,
    });
    deps.track('applied', {key, version: ticket.version});
  } catch (error) {
    await recordFailure(
      deps,
      key,
      kind,
      error instanceof Error ? error.message : 'unknown',
    );
    if (reason === 'user') throw error;
  }
}

export async function removeResource(
  deps: EngineDeps,
  key: string,
): Promise<void> {
  const row = await deps.registry.get(key);
  const kind: ContentKind =
    row?.kind ??
    (key.startsWith('qf:translations:') ? 'translation' : 'tafsir');
  await deps.installers[kind]?.remove(key);
  await deps.registry.upsert({
    ...(row ?? emptyRow(key, kind)),
    version: 0,
    sha256: null,
    user_removed: true,
    legacy: false,
  });
}

function isPlaceholder(row: LocalContentRow): boolean {
  // A failure placeholder: no install ever succeeded (installResource always sets
  // upstream_schema_version). Legacy rows and half-purged rows are real copies.
  return (
    !row.legacy &&
    row.installed_at === null &&
    row.version === 0 &&
    row.upstream_schema_version === null
  );
}

async function purge(
  deps: EngineDeps,
  installer: ContentInstaller,
  row: LocalContentRow,
  entry: ManifestEntry | undefined,
): Promise<void> {
  if (isPlaceholder(row)) {
    await deps.registry.delete(row.key);
    return;
  }
  await installer.remove(row.key);
  // Data is gone: never let a later failure leave the row claiming an installed copy.
  const removed: LocalContentRow = {
    ...row,
    version: 0,
    sha256: null,
    installed_at: null,
  };
  await deps.registry.upsert(removed);
  await installer.onWithdrawn(row.key);
  if (!row.withdrawal_notified) {
    deps.notify({key: row.key, name: row.name ?? entry?.meta?.name ?? row.key});
    // Persisted before the delete so a failed delete cannot repeat the notice.
    await deps.registry.upsert({...removed, withdrawal_notified: true});
  }
  await deps.registry.delete(row.key);
  deps.track('withdrawn', {
    key: row.key,
    version: row.version,
    reason: entry?.withdrawn_reason ?? 'absent',
  });
}

async function applyRow(
  deps: EngineDeps,
  installer: ContentInstaller,
  row: LocalContentRow,
  entry: ManifestEntry | undefined,
  onWifi: () => Promise<boolean>,
): Promise<void> {
  if (!entry || entry.status === 'withdrawn') {
    // Withdrawals are retried on every check, ignoring backoff, so removal is never delayed.
    await purge(deps, installer, row, entry);
    return;
  }
  const needsUpdate = row.legacy || entry.version > row.version;
  // A missing schema version is unknown, so treat it as unsupported.
  const schemaOk =
    entry.upstream_schema_version !== undefined &&
    installer.supportsSchemaVersion(entry.upstream_schema_version);
  const backoffOver = retryIsDue(row.next_retry_at, deps.now());
  if (!needsUpdate || !schemaOk || !backoffOver) return;
  const networkOk =
    (entry.bytes ?? 0) <= WIFI_THRESHOLD_BYTES || (await onWifi());
  if (!networkOk) return;
  await deps.registry.upsert({...row, name: entry.meta?.name ?? row.name});
  await installResource(deps, row.key, row.kind, 'auto', entry.version);
}

export async function runContentCheck(
  deps: EngineDeps,
  opts: {force?: boolean} = {},
): Promise<CheckOutcome> {
  const state = await deps.registry.getState();
  if (!opts.force && !checkIsDue(state.lastCheckedAt, deps.now()))
    return 'skipped_recent';

  const kinds = (Object.keys(deps.installers) as ContentKind[]).filter(
    kind => deps.installers[kind],
  );
  const result = await deps.api.fetchManifest(kinds, state.manifestEtag);
  if (result.status === 'error') return 'error';
  if (result.status === 'not_modified') {
    await deps.registry.setState({lastCheckedAt: deps.now()});
    return 'not_modified';
  }
  await deps.registry.setState({
    manifestEtag: result.etag,
    lastCheckedAt: deps.now(),
  });
  if (result.manifest.paused) return 'paused';

  const entries = new Map(
    result.manifest.resources.map(entry => [entry.key, entry]),
  );
  let wifi: Promise<boolean> | null = null;
  function onWifi(): Promise<boolean> {
    wifi ??= deps.isOnWifi();
    return wifi;
  }
  for (const row of await deps.registry.list()) {
    const installer = deps.installers[row.kind];
    if (!installer || row.user_removed) continue;
    try {
      await applyRow(deps, installer, row, entries.get(row.key), onWifi);
    } catch (error) {
      // One failing row must not block the others; it retries via its backoff.
      await recordFailure(
        deps,
        row.key,
        row.kind,
        error instanceof Error ? error.message : 'unknown',
      ).catch(() => undefined);
    }
  }
  return 'applied';
}
