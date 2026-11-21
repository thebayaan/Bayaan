/* eslint-env node, es2020 */
// The real engine, from node_modules, keeping hold of the session so the harness can lock
// the tracker by hand on the clips that need it.
import {createRequire} from 'node:module';
const DIST = new URL(
  '../../../../../node_modules/@tilawa/core/dist',
  import.meta.url,
).pathname;
globalThis.require = createRequire(`${DIST}/recitation/session.js`);
const real = await import(`${DIST}/index.js`);
export const costTable = real.costTable;
export const DEFAULT_STRUCTURAL = real.DEFAULT_STRUCTURAL;
export const held = {session: null};
export async function createZipformerSession(opts) {
  held.session = await real.createZipformerSession(opts);
  return held.session;
}
