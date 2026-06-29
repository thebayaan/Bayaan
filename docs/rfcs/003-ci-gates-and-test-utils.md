# RFC-003: CI test gate + `@bayaan/test-utils` package

| Field    | Value      |
| -------- | ---------- |
| Status   | Proposed   |
| Date     | 2026-05-03 |
| Author   | Omar Zarka |

## Summary

Two paired changes that together close a small but real gap in the workspace established by [RFC-001](001-workspace-and-rfc-convention.md) and populated by [RFC-002](002-bayaan-types-package.md):

1. Add a **Jest CI workflow** (`.github/workflows/test.yml`) that runs the Jest suite on every push / PR — covering both the app's existing tests and any tests in `packages/*`.
2. Add a second workspace package: **`@bayaan/test-utils`** — a tiny library of shared test helpers (custom Jest matchers for `BayaanError`, scoped initially to what's reachable today). Designed to grow alongside subsequent feature packages.

No app code changes. No modifications to the existing `lint.yml`. Purely additive infrastructure, bounded to enable the heavier extraction RFCs without re-litigating tooling each time.

## Motivation

After RFC-002 landed, the workspace has:
- One package (`@bayaan/types`) with 9 contract tests.
- A root `package.json` with `"test": "jest --watchAll"` (interactive — not CI-suitable).
- A `lint.yml` workflow running Prettier / ESLint / `tsc`. **No automatic test execution.**
- `npx jest --watchAll=false` happens to work locally and picks up package tests via the workspace symlink, but nothing enforces it on PRs.

Two consequences if we proceed without addressing this:

- **Test drift.** The next RFC (audio seam) ships a `PlayerController` port and an adapter scaffold. RFC-005 (mushaf split) ships more. Each will land contract tests. Without a CI gate, those tests rot silently the moment someone updates a peer dependency or a type signature; we discover the breakage during the next PR's local run, not at the PR boundary.
- **Test plumbing duplication.** Every feature package will want the same handful of helpers — the most obvious being a way to assert "this threw a `BayaanAudioError` with code `AUDIO_LOAD_FAILED`". Without a shared package, each downstream RFC re-implements the matcher locally. Three implementations diverge silently.

The fix is a small CI workflow plus a bounded helpers package — both additive, both reversible.

A note on scope discipline: this RFC deliberately does **not** flip the `continue-on-error` flags on Prettier or ESLint in `lint.yml`. That's a behavior change in CI signals (PRs that pass today would start failing) and belongs in its own change with a coordinated lint-debt cleanup pass. RFC-003 is purely additive.

## Decision

### 1. Add `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  jest:
    name: Jest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --no-audit --no-fund
      - name: Jest
        env:
          NODE_OPTIONS: --max-old-space-size=4096
        run: npm run test:ci
```

Mirrors `lint.yml`'s shape. Same Node version, same caching, same heap bump (Jest also wants more than the default 1.7 GB once `jest-expo` initializes Metro's transform cache).

### 2. Add a `test:ci` script to root `package.json`

```diff
   "scripts": {
     "test": "jest --watchAll",
+    "test:ci": "jest --watchAll=false --ci --reporters=default",
```

The existing `test` script stays interactive (matches the developer expectation of `npm test` in an RN/Expo project). The new `test:ci` is non-interactive and explicit about CI mode.

### 3. Add `packages/bayaan-test-utils/`

Mirror the layout RFC-002 established for `@bayaan/types`:

```
packages/bayaan-test-utils/
├── package.json          # name: @bayaan/test-utils, version: 0.1.0, AGPL-3.0-or-later, "private": true, depends on @bayaan/types
├── tsconfig.json         # extends expo/tsconfig.base
├── jest.config.js        # preset: jest-expo, testMatch: src/**/__tests__/**/*.test.ts
├── README.md
└── src/
    ├── index.ts          # re-exports
    ├── error-matchers.ts # toBeBayaanError, toThrowBayaanError matchers
    └── __tests__/
        └── error-matchers.test.ts
```

`main` and `types` both point at `src/index.ts`. No build step.

#### What the package exports (initial)

```ts
import type {ErrorCode} from '@bayaan/types';
import {BayaanError} from '@bayaan/types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBayaanError(code?: ErrorCode): R;
    }
    interface Expect {
      toBeBayaanError(code?: ErrorCode): unknown;
    }
  }
}

export const bayaanErrorMatchers = {
  toBeBayaanError(received: unknown, code?: ErrorCode) { /* … */ },
};

/** One-call setup for jest.setup.ts. */
export function registerBayaanMatchers(): void {
  expect.extend(bayaanErrorMatchers);
}
```

Consumer usage in a feature-package test:

```ts
import {registerBayaanMatchers} from '@bayaan/test-utils';
import {BayaanAudioError} from '@bayaan/types';

beforeAll(() => registerBayaanMatchers());

test('rejects malformed source', () => {
  expect(() => loadTrack(badUrl)).toThrow();
  // or with the matcher:
  const err = catchError(() => loadTrack(badUrl));
  expect(err).toBeBayaanError('AUDIO_SOURCE_INVALID');
});
```

The matcher stays small on purpose. Async support, `.toThrow`-style wrapping, snapshot integration — all intentionally out of scope until a feature package needs them. **Add when the second consumer asks; not before.**

### 4. One unrelated cleanup — `testPathIgnorePatterns` for an empty test file

`utils/__tests__/storageAnalytics.test.ts` exists on `develop` as a 0-byte file (added in `0cd01e4` "updated playback and queueing architecture"). Today it's harmless — `npm test --watchAll` shows it as a failed suite locally and humans ignore it. The moment a CI test gate exists, that 0-byte file fails the new workflow on every PR.

The smallest possible fix is a targeted `testPathIgnorePatterns` entry on the root jest config:

```diff
   "jest": {
-    "preset": "jest-expo"
+    "preset": "jest-expo",
+    "testPathIgnorePatterns": [
+      "/node_modules/",
+      "<rootDir>/utils/__tests__/storageAnalytics.test.ts"
+    ]
   },
```

This is technically off-scope for "add CI gates" (it's a maintenance fix on an unrelated file), but the alternative is shipping a CI gate that's red on day one. **Open question for the maintainer:** prefer this targeted ignore, or would you rather (a) split it into a separate cleanup PR that lands first, or (b) delete the empty file outright? Easy to redirect.

### 5. What this RFC does NOT change

- `lint.yml` — untouched. Prettier and ESLint stay `continue-on-error: true`. That's a separate cleanup PR.
- The root `tsc --noEmit` step — already covers `packages/*` via the workspace symlink (RFC-002's verification confirmed this).
- The interactive `npm test` developer flow — preserved verbatim.
- App code — no imports of `@bayaan/test-utils` anywhere. The `@bayaan/types` package, once consumed, will use `@bayaan/test-utils` in its tests; nothing else does yet.

### 6. Versioning

`@bayaan/test-utils@0.1.0`. Same `0.x` discipline as `@bayaan/types`: stays `0.x` until a feature package consumes it in production. Promote to `1.0.0` at first stable adoption.

## Alternatives considered

### A — Add tests to the existing `lint.yml` job

Reuse `lint.yml`, append a `Jest` step.

**Rejected.** Concurrency group, cancel-in-progress, and step ordering are already tuned for the lint job. Adding tests would either run them after the typecheck (slowing PR signal) or before it (worse signal — typecheck failures should pre-empt test runs). A separate workflow lets each one fail-fast independently and run in parallel.

### B — Include the matcher in `@bayaan/types` directly

Drop `@bayaan/test-utils` and put `bayaanErrorMatchers` in `@bayaan/types` under `@bayaan/types/test`.

**Rejected.** `@bayaan/types` declares `sideEffects: false` and is consumed in production bundles. Test-only code doesn't belong there even behind a sub-path; tree-shaking buys us nothing if the package conceptually mixes concerns.

### C — Defer test-utils until a second consumer asks

Ship CI workflow now, defer the package. Each feature-package RFC reinvents matchers as needed.

**Rejected.** RFC-004 (audio seam) and RFC-005 (mushaf split) both need `BayaanError` matchers in their contract tests. Deferring guarantees three duplicates that diverge. Cheaper to ship the bounded scaffold now.

### D — Use an existing matcher library (e.g., `jest-extended`, custom-error-matchers)

Pull in a third-party matcher dep instead of writing our own.

**Rejected.** None of the popular libraries know about `BayaanError.code` — the most useful assertion. We'd still need a custom matcher for that. Adding a dep for the rest is more surface than it's worth.

## Consequences

**Positive**

- Every PR runs the Jest suite on CI. Test drift caught at the PR boundary.
- Future feature-package RFCs can `import {registerBayaanMatchers} from '@bayaan/test-utils'` — one-line setup, no boilerplate.
- The matcher's contract tests live in the package itself, so the test infrastructure is self-verifying.
- Confirms (a second time) that the `packages/*` workspace pattern works for non-types packages with cross-package dependencies (`@bayaan/test-utils` → `@bayaan/types`).

**Neutral**

- One new GitHub Actions job per push / PR. Same runner image as `lint.yml`; cache-warmed `npm ci` is fast.
- One new workspace symlink at `node_modules/@bayaan/test-utils -> packages/bayaan-test-utils`.
- Adds one new line to `package.json scripts`.

**Negative / risks**

- The matcher's API will likely grow as feature packages adopt it. Each addition is a minor-version bump (`0.x.y → 0.x.y+1`); breaking changes go to `0.(x+1).0` until 1.0. Mitigation: keep the API tight; add only when a real consumer asks.
- A test that uses `registerBayaanMatchers()` at the top of one file but not another can mis-suggest the matcher works globally. Mitigation: documented in the package README; the long-run pattern is a single jest setup file per package that calls it once.

## How we'll know it worked

- The Jest CI workflow runs green on this PR.
- `npx tsc --noEmit` produces no new errors versus develop's baseline.
- Local `npm run test:ci` runs the full suite (existing + 9 from `@bayaan/types` + new tests in `@bayaan/test-utils`) and exits 0.
- iOS and Android builds produce identical artifacts to develop.
- A subsequent RFC (likely RFC-004, audio seam) imports `registerBayaanMatchers` and the import resolves cleanly.

## Open questions (deferred)

- **Should `lint.yml`'s Prettier/ESLint flip to blocking?** Out of scope here. Worth a separate cleanup pass once the existing debt has been paid down.
- **Test sharding by package via `jest --projects`.** Not needed at 9 + new tests. Worth revisiting once the suite hits ~5+ packages and parallel runs would matter for PR latency.
- **`@bayaan/test-utils` exports for adapter-side mocks** (e.g., `mockAudioPlayer`). Comes naturally with RFC-004 — adding here would be premature.
