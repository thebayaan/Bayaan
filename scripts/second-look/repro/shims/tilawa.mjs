/* eslint-env node, es2020 */
// The real engine, keeping hold of the session so the harness can lock the tracker by
// hand on the clips that need it, as the bench does.
import * as real from '@tilawa/core';

export * from '@tilawa/core';
export async function createZipformerSession(opts) {
  const session = await real.createZipformerSession(opts);
  globalThis.__repro.session = session;
  return session;
}
