// Content freshness layer (spec 2026-10-05). Shapes match the backend manifest and envelope.

export type ContentKind = 'tafsir' | 'translation';

export interface ContentMeta {
  name?: string;
  author?: string | null;
  language?: string;
  direction?: 'ltr' | 'rtl';
  slug?: string;
  attribution?: string;
}

export interface ManifestEntry {
  key: string;
  kind: ContentKind;
  source: string;
  version: number;
  status: 'active' | 'withdrawn';
  upstream_schema_version?: number;
  bytes?: number;
  sha256?: string;
  meta?: ContentMeta;
  withdrawn_reason?: string | null;
}

export interface Manifest {
  format: 1;
  generated_at: string;
  paused: boolean;
  resources: ManifestEntry[];
}

export interface DownloadTicket {
  url: string;
  version: number;
  sha256: string;
  bytes: number;
  expires_at: string;
}

export interface QfSnapshot {
  resource_group: string;
  resource_id: number;
  resource_content_id?: number;
  schema_version: number;
  sync_sequence?: number;
  records: Array<Record<string, unknown>>;
}

export interface ContentEnvelope {
  envelope: 1;
  key: string;
  version: number;
  source: string;
  fetched_at: string;
  snapshot: QfSnapshot;
}

export interface LocalContentRow {
  key: string;
  kind: ContentKind;
  version: number;
  sha256: string | null;
  upstream_schema_version: number | null;
  installed_at: number | null;
  legacy: boolean;
  user_removed: boolean;
  failures: number;
  next_retry_at: number | null;
  withdrawal_notified: boolean;
  name: string | null;
}

export interface WithdrawalNotice {
  key: string;
  name: string;
}

export interface InstallOutcome {
  // The display name the installer stored, for the registry and notices.
  name: string | null;
}

export interface ContentInstaller {
  kind: ContentKind;
  supportsSchemaVersion(version: number): boolean;
  install(
    key: string,
    envelope: ContentEnvelope,
    meta: ContentMeta | undefined,
  ): Promise<InstallOutcome | undefined>;
  remove(key: string): Promise<void>;
  onWithdrawn(key: string): Promise<void>;
  // A bundled display name for a key, used when the registry has none.
  fallbackName?(key: string): string | undefined;
}
