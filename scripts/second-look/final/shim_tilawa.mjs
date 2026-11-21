/* eslint-env node, es2020 */
// The real engine under the app's real wrapper. The harness keeps hold of the session,
// so it can lock the tracker by hand on the clips that need it, as the bench does, and
// may add options a suite asks for (the place kept on added-word events).
import * as real from '@tilawa/core';

export * from '@tilawa/core';
export async function createZipformerSession(opts) {
  const extra = globalThis.__repro.engineExtra ?? {};
  const session = await real.createZipformerSession({
    ...opts,
    ...extra,
    config: {...opts.config, ...(extra.config ?? {})},
  });
  globalThis.__repro.session = session;
  const feed = session.feed.bind(session);
  // Before the wrapper reads this chunk's verdicts, as bench.mjs locks by hand.
  session.feed = async pcm => {
    const out = await feed(pcm);
    await globalThis.__repro.afterFeed?.(session);
    return out;
  };
  return session;
}
