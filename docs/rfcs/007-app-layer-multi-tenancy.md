# RFC-007: App-layer multi-tenancy seams

| Field  | Value      |
| ------ | ---------- |
| Status | Proposed   |
| Date   | 2026-05-03 |
| Author | Omar Zarka |

## Summary

Introduce three thin config seams — `config/branding.js` (app identity), `config/featureFlags.ts` (feature gating), and a `CatalogProvider` interface (audio-catalog abstraction) — so that a sibling fork can override Bayaan's app identity, suppress features, and supply its own reciter catalog without touching any application code. Zero behavior change for Bayaan itself.

## Motivation

Bayaan is increasingly used as an upstream platform. A sister app, Qariah, forks Bayaan to ship a curated female-reciter catalog under a different brand. Today there is no supported override layer; every divergence is a direct file edit that conflicts on every weekly upstream merge.

Three categories of hardcoded values cause friction:

**1. App identity.** `app.config.js` has `name: 'Bayaan'`, `slug: 'Bayaan'`, `scheme: 'bayaan'`, `bundleIdentifier: 'com.bayaan.app'`. App source code has additional hardcoded strings:

- `utils/shareUtils.ts:4` — `const BASE_URL = 'https://app.thebayaan.com'`
- `app/(tabs)/(d.settings)/index.tsx:263–272` — `Linking.openURL('https://thebayaan.com/support')`, `.../terms`, `.../privacy`
- `services/emailService.ts:23` — `product_name: 'Bayaan'`

A fork that can't change these safely will either edit the files (conflict risk) or ship a broken identity.

**2. Feature set.** Some features are not appropriate for every consumer (e.g., a curated catalog doesn't need user-upload or adhkar modules). There is no gating layer; a fork must delete or comment out code.

**3. Audio catalog.** `data/reciterData.ts` and `data/reciters-fallback.json` contain ~250 male reciters sourced from quran.com. A sister app with a different reciter set has no seam to supply its own catalog without replacing those files wholesale — a hard merge conflict every week.

## Decision

### 1. `config/branding.js` — app identity knobs

A CommonJS module (CJS required: `app.config.js` calls `require()` before Expo CLI transpiles the tree). Exports the subset of identity values that vary across forks:

```js
// config/branding.js — zero-change defaults for Bayaan
module.exports = {
  appName: 'Bayaan',
  appSlug: 'Bayaan',
  urlScheme: 'bayaan',
  bundleId: {
    ios: 'com.bayaan.app',
    android: 'com.bayaan.app',
  },
  supportUrl: 'https://thebayaan.com/support',
  termsUrl: 'https://thebayaan.com/terms',
  privacyUrl: 'https://thebayaan.com/privacy',
  shareBaseUrl: 'https://app.thebayaan.com',
  emailProductName: 'Bayaan',
  catalog: {
    source: 'bundled',    // 'bundled' | 'remote'
    fallbackPath: undefined,  // path to a JSON file; undefined = use data/reciters-fallback.json
  },
};
```

A sibling `.d.ts` carries TypeScript types for callers that import from TS (same pattern Qariah already uses):

```ts
// config/branding.d.ts
export interface BrandingCatalogConfig {
  source: 'bundled' | 'remote';
  fallbackPath?: string;
}
export interface Branding {
  appName: string;
  appSlug: string;
  urlScheme: string;
  bundleId: { ios: string; android: string };
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
  shareBaseUrl: string;
  emailProductName: string;
  catalog: BrandingCatalogConfig;
}
declare const branding: Branding;
export default branding;
```

**Migration path for Bayaan call sites (separate PRs, not this RFC):**

| File | Line | From | To |
|------|------|------|----|
| `utils/shareUtils.ts` | 4 | `'https://app.thebayaan.com'` | `require('@/config/branding').shareBaseUrl` |
| `app/(tabs)/(d.settings)/index.tsx` | 263–272 | inline URL literals | `branding.supportUrl`, `.termsUrl`, `.privacyUrl` |
| `services/emailService.ts` | 23 | `'Bayaan'` | `branding.emailProductName` |

This RFC only adds the file. The call-site migrations each fit in a single-line goodwill PR; no RFC needed for those.

### 2. `config/featureFlags.ts` — feature gating

```ts
// config/featureFlags.ts — all features on; Bayaan ships everything
export const featureFlags = {
  adhkar: true,
  ambientAudioOverlay: true,
  userUploads: true,
  wordByWordTransliteration: true,
  pushNotifications: true,
  coloredHighlights: true,
  verseNotes: true,
  backgroundVideoOverlay: false,  // deprecated; not coming back
  multiTranslation: true,
  tafsir: true,
  sleepTimer: true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
```

Call sites replace direct boolean checks with `isFeatureEnabled('flagName')`. This RFC adds the file; call-site adoption is a follow-on PR.

### 3. `CatalogProvider` interface — catalog abstraction

Rather than a hard import from `data/reciterData.ts`, a provider seam lets a fork supply its own reciter list:

```ts
// types/CatalogProvider.ts
import { Reciter } from './reciter-profile';

export interface CatalogProvider {
  /** Returns all reciters in the catalog. */
  getAllReciters(): Reciter[];
  /** Returns a single reciter by id, or undefined. */
  getReciterById(id: string): Reciter | undefined;
}
```

The default implementation wraps the existing `RECITERS` array:

```ts
// data/defaultCatalogProvider.ts
import { RECITERS } from './reciterData';
import { CatalogProvider } from '@/types/CatalogProvider';

export const defaultCatalogProvider: CatalogProvider = {
  getAllReciters: () => RECITERS,
  getReciterById: (id) => RECITERS.find(r => r.id === id),
};
```

A service layer (`services/catalogService.ts`) holds the active provider, defaulting to `defaultCatalogProvider`. A fork calls `setCatalogProvider(myProvider)` once at app boot.

This RFC adds the interface and the default implementation. Wiring the service layer and migrating call sites is a follow-on PR.

## Alternatives considered

### A — env-variable everything

All identity values as `process.env` reads in `app.config.js` (extending the existing `APPLE_TEAM_ID` / `EAS_PROJECT_ID` pattern).

**Rejected.** Runtime JS (`utils/shareUtils.ts`, `services/emailService.ts`) can't read build-time `process.env`. Works for `app.config.js` (build-time) but not app source. Two different override mechanisms for the same conceptual thing (app identity) is confusing.

### B — fork-and-ignore (status quo for forks)

Forks simply edit the files and accept the weekly merge conflicts.

**Rejected.** This is the exact problem being solved. Every merge conflict risks accidentally shipping the wrong identity; every resolution costs developer time.

### C — Separate npm package (`@bayaan/branding`)

Ship branding config as a workspace package.

**Rejected.** Overkill for a single config file. The workspace packages track (RFC-001 through RFC-006) is for self-contained feature libraries. Branding is a thin config layer; a package adds versioning overhead without value.

### D — Extend `app.config.js` only (no runtime config file)

All identity knobs go into `app.config.js` and are injected as `expo-constants` values read at runtime.

**Rejected.** `expo-constants` is async-initialized and not synchronously available in all call sites. CJS `require('@/config/branding')` is synchronous and works in any file.

## Consequences

**Positive**
- Forks can override brand identity, feature set, and catalog without touching application code.
- Call-site migrations are small, independent, reviewable PRs — no big-bang rewrite.
- Zero behavior change for Bayaan at merge time (all flags default to `true`; branding defaults to Bayaan values; default provider wraps existing `RECITERS`).

**Neutral**
- Adds three new files (`config/branding.js`, `config/branding.d.ts`, `config/featureFlags.ts`, `types/CatalogProvider.ts`, `data/defaultCatalogProvider.ts`) with no app-side imports yet.
- Existing `app.config.js` env-var pattern (`APPLE_TEAM_ID`, `EAS_PROJECT_ID`, `PRIVACY_POLICY_URL`) is unaffected; `config/branding.js` is a complementary layer for runtime + app-config consumers.

**Negative / risks**
- `config/featureFlags.ts` introduces a dependency for every feature gate. Discipline required: flags are for fork-configurable features, not per-user A/B tests. Recommend a code comment enforcing the distinction.
- The `CatalogProvider` interface commits Bayaan to a specific provider contract shape. Getting the interface wrong before call sites are wired means a breaking change. Mitigation: keep the interface minimal (only `getAllReciters` + `getReciterById` in v1).

## How we'll know it worked

- `npx tsc --noEmit` from repo root produces no new errors.
- iOS and Android builds produce identical artifacts to `develop` baseline (no behavior change, no new network calls, no UI changes).
- A fork (Qariah) can drop in override files and build with its own brand/flags/catalog without touching any file also present in `develop`.
- CI branding-conformance lint (Qariah-side) passes without allowlist additions for new hardcoded strings.

## Open questions

- **Call-site migration ordering.** Should `config/branding.js` call sites migrate in one PR or file-by-file? No strong opinion; file-by-file is safer and each PR is trivially reviewable.
- **Feature flag granularity.** The flag list above matches what Qariah currently gates. Bayaan may want flags for other cross-fork features not yet imagined. Additive; flags can be extended without a new RFC.
- **`CatalogProvider` v2 shape.** v1 has only `getAllReciters` + `getReciterById`. If remote catalogs need pagination or async loading, the interface will need extension. Deferred to the RFC that introduces remote catalog support.
