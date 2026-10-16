// @ai-generated
/**
 * CI must run the *.alldbs suites (every verse of every bundled words DB).
 * They only run when BAYAAN_OVERLAY_DB_DIR is set and node:sqlite loads
 * (Node >= 22.13); otherwise they skip, or fail while collecting, so on GitHub
 * Actions this names the missing piece. The Jest workflow
 * (.github/workflows/test.yml) sets BAYAAN_OVERLAY_DB_DIR=bundled on Node 22.
 * Skipped outside GitHub Actions.
 */
const run = process.env.GITHUB_ACTIONS === 'true' ? describe : describe.skip;

run('the *.alldbs suites on GitHub Actions', () => {
  it('read the bundled words DBs', () => {
    expect(process.env.BAYAAN_OVERLAY_DB_DIR).toBe('bundled');
  });

  it('can open them with node:sqlite', () => {
    expect(() => require('node:sqlite')).not.toThrow();
  });
});
