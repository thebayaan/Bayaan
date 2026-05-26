# `@bayaan/test-utils`

Shared Jest test helpers for `@bayaan/*` packages. Internal to the workspace; not published.

## What's here

- `bayaanErrorMatchers` — Jest custom matchers that understand the `BayaanError` hierarchy from `@bayaan/types`.
  - `expect(value).toBeBayaanError(code?)` — asserts the value is a `BayaanError` (optionally with a specific `ErrorCode`).
- `registerBayaanMatchers()` — one-call helper that calls `expect.extend(bayaanErrorMatchers)`. Use it in a Jest setup file.

## Usage

In a feature-package test:

```ts
import {registerBayaanMatchers} from '@bayaan/test-utils';
import {BayaanAudioError} from '@bayaan/types';

beforeAll(() => registerBayaanMatchers());

test('rejects malformed source', () => {
  const err = new BayaanAudioError('AUDIO_SOURCE_INVALID', 'bad uri', {
    recoverable: false,
  });
  expect(err).toBeBayaanError('AUDIO_SOURCE_INVALID');
  expect(err).toBeBayaanError(); // no code: just asserts BayaanError-ness
});
```

For consumers that want it registered globally, point Jest's `setupFilesAfterEach` at a one-line setup file:

```js
// jest.setup.ts
import {registerBayaanMatchers} from '@bayaan/test-utils';
registerBayaanMatchers();
```

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
};
```

## Scope rules

This package is for **test-only helpers consumed by 2+ packages**. Don't put production code here.

Adding new matchers / mocks: bump `0.x.y → 0.x.y+1` for additions, `0.x → 0.(x+1)` for breaking signature changes, until first stable adoption (then 1.0). Same versioning convention as `@bayaan/types` per [RFC-002](../../docs/rfcs/002-bayaan-types-package.md).
