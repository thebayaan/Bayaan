/**
 * Bayaan platform error machinery.
 *
 * Every error produced by `@bayaan/*` packages is a `BayaanError` subclass.
 * Consumers branch on `error.code` (stable enum) or `error instanceof
 * BayaanAudioError` (domain marker), never on `error.message`.
 *
 * Two categories by handling:
 *   - Recoverable (`recoverable: true`) — flow through callback ports
 *     (`onError` callbacks); service continues to function.
 *   - Non-recoverable (`recoverable: false`) — thrown synchronously from the
 *     offending method; signal a programming error (lifecycle violation,
 *     precondition failure).
 */

/**
 * Stable enum of error codes. Adding a code is a minor-version bump; renaming
 * or removing is a major-version bump. Consumers may safely branch on any
 * string in this union.
 */
export type ErrorCode =
  // ── Lifecycle (across all services) ────────────────────────────────────────
  | 'LIFECYCLE_AFTER_DESTROY'
  | 'LIFECYCLE_BEFORE_INIT'
  | 'PRECONDITION_VIOLATED'
  // ── Audio ──────────────────────────────────────────────────────────────────
  | 'AUDIO_LOAD_FAILED'
  | 'AUDIO_SEEK_FAILED'
  | 'AUDIO_PLAYBACK_FAILED'
  | 'AUDIO_SOURCE_INVALID'
  | 'AUDIO_INTERRUPTED'
  // ── Mushaf data ────────────────────────────────────────────────────────────
  | 'MUSHAF_DB_NOT_FOUND'
  | 'MUSHAF_DB_SCHEMA_MISMATCH'
  | 'MUSHAF_REWAYAH_NOT_AVAILABLE'
  | 'MUSHAF_PAGE_OUT_OF_RANGE'
  // ── Rewayat ────────────────────────────────────────────────────────────────
  | 'REWAYAT_DIFF_MISSING'
  | 'REWAYAT_DIFF_MALFORMED'
  // ── Mushaf render ──────────────────────────────────────────────────────────
  | 'SKIA_NOT_READY'
  | 'LAYOUT_COMPUTE_FAILED'
  // ── Lock screen ────────────────────────────────────────────────────────────
  | 'LOCK_SCREEN_METADATA_REJECTED'
  | 'LOCK_SCREEN_CONTROLS_UNAVAILABLE'
  // ── Network ────────────────────────────────────────────────────────────────
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_HTTP_ERROR';

export interface BayaanErrorOptions {
  recoverable: boolean;
  context?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * Base class for all platform errors. Use the domain subclasses
 * (`BayaanAudioError`, `BayaanMushafError`, …) when throwing or constructing
 * for `instanceof` matching downstream.
 */
export class BayaanError extends Error {
  readonly code: ErrorCode;
  readonly recoverable: boolean;
  readonly context: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options: BayaanErrorOptions) {
    super(message);
    this.name = 'BayaanError';
    this.code = code;
    this.recoverable = options.recoverable;
    this.context = Object.freeze({...(options.context ?? {})});
    this.cause = options.cause;
  }
}

/** Audio-domain errors. Use for AUDIO_* codes. */
export class BayaanAudioError extends BayaanError {
  constructor(code: ErrorCode, message: string, options: BayaanErrorOptions) {
    super(code, message, options);
    this.name = 'BayaanAudioError';
  }
}

/** Mushaf-domain errors. Use for MUSHAF_* / REWAYAT_* / SKIA_* codes. */
export class BayaanMushafError extends BayaanError {
  constructor(code: ErrorCode, message: string, options: BayaanErrorOptions) {
    super(code, message, options);
    this.name = 'BayaanMushafError';
  }
}

/** Lifecycle errors. Use for LIFECYCLE_* / PRECONDITION_* codes. */
export class BayaanLifecycleError extends BayaanError {
  constructor(code: ErrorCode, message: string, options: BayaanErrorOptions) {
    super(code, message, options);
    this.name = 'BayaanLifecycleError';
  }
}

/** Network errors. Use for NETWORK_* codes. */
export class BayaanNetworkError extends BayaanError {
  constructor(code: ErrorCode, message: string, options: BayaanErrorOptions) {
    super(code, message, options);
    this.name = 'BayaanNetworkError';
  }
}
