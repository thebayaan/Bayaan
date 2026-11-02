// @ai-generated
// Removes the temp root that jestGlobalSetup.js made for this run.
const fs = require('fs');

module.exports = async function globalTeardown() {
  const root = process.env.BAYAAN_JEST_SQLITE_ROOT;
  if (root) fs.rmSync(root, {recursive: true, force: true});
};
