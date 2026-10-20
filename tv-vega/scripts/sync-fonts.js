#!/usr/bin/env node
/**
 * Copies the brand fonts into tv-vega/assets/fonts before a build. Vega has
 * no expo-font: it packages the app's assets/fonts folder and serves each
 * file under its name, so `Manrope-Bold.ttf` answers `fontFamily:
 * 'Manrope-Bold'` (theme/typography.ts). The files stay owned by tv-app; the
 * copies are build output (gitignored), so the two never drift.
 *
 * The surah-name and Quran fonts are tv-app's renamed copies
 * (SurahNames.ttf, UthmanicHafs.ttf): the phone's files call their families
 * 'icomoon' and 'KFGQPC HAFS Uthmanic Script', which matched neither their
 * file names nor theme/typography.ts, so the copies carry the family name
 * in both places.
 */
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', '..', 'tv-app', 'assets', 'fonts');
const target = path.resolve(__dirname, '..', 'assets', 'fonts');

fs.mkdirSync(target, {recursive: true});
const files = fs
  .readdirSync(source)
  .filter((name) => /^(Manrope-.*|SurahNames|UthmanicHafs)\.ttf$/.test(name));
if (files.length === 0) {
  console.error(`sync-fonts: no brand fonts found in ${source}`);
  process.exit(1);
}
for (const name of files) {
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
console.log(`sync-fonts: copied ${files.length} fonts to ${target}`);
