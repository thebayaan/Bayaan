// @ai-generated
// Removes the temp root that jestGlobalSetup.js made for this run, and gives the
// temp variables their old values.
const fs = require('fs');

module.exports = async function globalTeardown() {
  const run = global.__BAYAAN_JEST_TMP_RUN__;
  if (!run) return;
  for (const [name, value] of run.saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  fs.rmSync(run.root, {recursive: true, force: true});
};
