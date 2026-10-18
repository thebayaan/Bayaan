#!/usr/bin/env node
/**
 * Copies the brand fonts into tv-vega/assets/fonts before a build. Vega has
 * no expo-font: it packages the app's assets/fonts folder and serves each
 * file under its name, so `Manrope-Bold.ttf` answers `fontFamily:
 * 'Manrope-Bold'` (theme/typography.ts). The files stay owned by tv-app; the
 * copies are build output (gitignored), so the two never drift.
 *
 * Only Manrope is copied. The surah-name and Quran fonts name their families
 * differently from their files ('icomoon', 'KFGQPC HAFS Uthmanic Script'), so
 * they stay off on Vega (theme/calligraphy.kepler.ts) until a device run
 * confirms how Vega resolves them.
 */
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', '..', 'tv-app', 'assets', 'fonts');
const target = path.resolve(__dirname, '..', 'assets', 'fonts');

fs.mkdirSync(target, {recursive: true});
const files = fs
  .readdirSync(source)
  .filter((name) => /^Manrope-.*\.ttf$/.test(name));
if (files.length === 0) {
  console.error(`sync-fonts: no Manrope fonts found in ${source}`);
  process.exit(1);
}
for (const name of files) {
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
console.log(`sync-fonts: copied ${files.length} fonts to ${target}`);
