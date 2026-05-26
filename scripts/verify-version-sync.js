#!/usr/bin/env node
/**
 * Pre-archive sanity check: assert that the version+build values in
 * `app.config.ts` (via generate-version.js), the iOS `Info.plist`, and
 * `android/app/build.gradle` all agree.
 *
 * Why: version drift between source-of-truth (`app.config.ts`) and the
 * committed native files happens silently — `expo prebuild` regenerates
 * native dirs from the config, but if you bump the config and forget to
 * re-prebuild (or commit the prebuild output to a separate branch), the
 * archive will ship with stale version metadata. Apple rejects uploads
 * whose `CFBundleShortVersionString` is below a previously-shipped value,
 * and Play Store rejects builds with stale `versionCode`. Catching this
 * at archive time costs an extra build cycle.
 *
 * Run as the FIRST step in the iOS archive helper. Default is check-only
 * (no mutation). On drift, exits non-zero with a clear report; consumer
 * decides whether to invoke --fix.
 *
 * Usage:
 *   node scripts/verify-version-sync.js                    # check both platforms; exit 1 on drift
 *   node scripts/verify-version-sync.js --fix              # auto-patch both platforms
 *   node scripts/verify-version-sync.js --platform=ios     # check iOS only
 *   node scripts/verify-version-sync.js --platform=android # check Android only
 *   node scripts/verify-version-sync.js --platform=ios --fix
 *
 * `--platform` (default: both) lets a single-platform archive (e.g. iOS-only
 * release) skip the other platform's drift check. Without it a legitimate
 * Android-only build number bump would block an iOS archive.
 *
 * In scripts/ios-archive.sh, --fix is gated behind `VERIFY_FIX=1` so
 * archive runs don't silently mutate native files, and `--platform=ios`
 * is set so iOS archives don't fail on Android drift. See PR #251 review.
 *
 * Exit codes:
 *   0 — all 3 in sync (after --fix, this means the patch succeeded)
 *   1 — mismatch (without --fix; with --fix, only if patch failed)
 *   2 — parse error in one of the inputs
 *
 * Fork-agnostic: scans `ios/*\/Info.plist` rather than hardcoding the app name.
 *
 * Standing rule: sync the WORKING TREE (sed-patch Info.plist + build.gradle),
 * archive, THEN commit. Committing the sync first bumps the git-rev-list
 * commit count by 1, leaving native files 1 behind the new source-of-truth
 * at archive time. The `--fix` flag here makes the working-tree patch
 * idempotent and one-shot.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const args = process.argv.slice(2);
const FIX = args.includes('--fix');

// `--platform=<ios|android|both>` (default: both). Skip the platform that
// isn't being archived this run. Common case: the iOS App Store and Play
// Store ship on different cadences, so a legitimate Android-only build
// number bump shouldn't block an iOS archive.
//
// Supported forms: --platform=ios, --platform ios, --platform=android, etc.
const PLATFORM = (() => {
  const eq = args.find(a => a.startsWith('--platform='));
  if (eq) return eq.slice('--platform='.length);
  const idx = args.indexOf('--platform');
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return 'both';
})();
if (!['ios', 'android', 'both'].includes(PLATFORM)) {
  console.error(
    `--platform must be one of: ios, android, both (got: ${PLATFORM})`,
  );
  process.exit(2);
}
const CHECK_IOS = PLATFORM === 'ios' || PLATFORM === 'both';
const CHECK_ANDROID = PLATFORM === 'android' || PLATFORM === 'both';

function readVersionFromGenerator() {
  const {execFileSync} = require('child_process');
  // `--json-only` makes generate-version.js write only the JSON document,
  // no header. Avoids regex-extracting `{...}` from interleaved log output,
  // which would silently parse the wrong object if the generator ever logs
  // a JSON-shaped line before the result. See PR #251 review.
  const out = execFileSync(
    'node',
    [path.join(__dirname, 'generate-version.js'), '--json-only'],
    {encoding: 'utf8'},
  );
  const json = JSON.parse(out);
  return {
    semanticVersion: json.semanticVersion,
    buildNumber: String(json.buildNumber),
  };
}

// Directory names under `ios/` that are NEVER the app target. Filter
// these out of findInfoPlistPath() — they often contain their own
// Info.plist files (test targets in particular) and could be picked up
// by readdirSync's filesystem-order traversal before the app target.
// See PR #251 review.
const IOS_NON_APP_DIRS = new Set(['Pods', 'build', 'DerivedData']);

// Suffixes that mark a directory as an Xcode test/extension target rather
// than the app target. Test target plists track the test bundle's version,
// which is unrelated to the app's CFBundleShortVersionString — patching
// them silently corrupts the test bundle metadata. Extensions (`*Extension`,
// `*Widget`) are similarly out of scope for this script's intent.
const IOS_NON_APP_SUFFIXES = ['Tests', 'UITests', 'Extension', 'Widget'];

function findInfoPlistPath(repoRoot = REPO) {
  const iosDir = path.join(repoRoot, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  // Scan ios/<AppName>/Info.plist, filtering known non-app entries
  // (Pods, build artifacts) and entries whose name marks them as a test
  // target or extension. If multiple candidates remain after filtering,
  // surface the ambiguity loudly rather than picking one — better to
  // refuse than to silently patch the wrong file.
  const candidates = [];
  for (const entry of fs.readdirSync(iosDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (IOS_NON_APP_DIRS.has(entry.name)) continue;
    if (IOS_NON_APP_SUFFIXES.some(suffix => entry.name.endsWith(suffix))) {
      continue;
    }
    // Skip Xcode project/workspace bundle directories.
    if (
      entry.name.endsWith('.xcodeproj') ||
      entry.name.endsWith('.xcworkspace')
    ) {
      continue;
    }
    const candidate = path.join(iosDir, entry.name, 'Info.plist');
    if (fs.existsSync(candidate)) candidates.push(candidate);
  }
  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    throw new Error(
      `Ambiguous app target: found multiple ios/<App>/Info.plist candidates ` +
        `after filtering test targets and extensions:\n  ${candidates.join(
          '\n  ',
        )}\n` +
        `Add the non-app directory name to IOS_NON_APP_DIRS or IOS_NON_APP_SUFFIXES ` +
        `in scripts/verify-version-sync.js.`,
    );
  }
  return candidates[0];
}

function readVersionFromInfoPlist(repoRoot = REPO) {
  const p = findInfoPlistPath(repoRoot);
  if (!p) {
    throw new Error(
      'Could not find ios/<App>/Info.plist — has `expo prebuild` run yet?',
    );
  }
  const text = fs.readFileSync(p, 'utf8');
  const semantic =
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(
      text,
    );
  const build = /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/.exec(
    text,
  );
  if (!semantic || !build) {
    throw new Error(`Could not parse version from ${p}`);
  }
  return {semanticVersion: semantic[1], buildNumber: build[1], path: p};
}

// iOS Share / Action / Notification extension targets carry their own
// CFBundleShortVersionString + CFBundleVersion values in Xcode build
// settings (`MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` written into
// `project.pbxproj`). Their stub `*-Info.plist` files don't contain the
// raw CFBundle keys — Xcode generates them at build time by substituting
// the build settings. So we parse the pbxproj, not the plist.
//
// Apple's processor warns at submission time when an embedded
// extension's CFBundleVersion drifts from the parent app's
// (`CFBundleVersion of an app extension ('N') must match that of its
// containing parent app ('M')`). The warning isn't a hard rejection
// but it pollutes the upload log and the extension's TestFlight build
// metadata stays stale. PR #251 introduced this verifier for the main
// app's Info.plist + Android gradle; this widens it to cover Xcode
// extension targets (Share Extension, Action Extension, Notification
// Service, Widget, etc.).
//
// Auto-discovery: scan `project.pbxproj` for `XCBuildConfiguration`
// blocks whose `INFOPLIST_FILE` points at a file ending `-Info.plist`
// (Xcode's convention for non-main-app target stub plists). Each such
// block carries one Debug + one Release entry; we read + patch both.
function findExtensionConfigBlocks(repoRoot = REPO) {
  const candidates = [];
  const iosDir = path.join(repoRoot, 'ios');
  if (!fs.existsSync(iosDir)) return {pbxprojPath: null, blocks: candidates};
  // Find the .xcodeproj/project.pbxproj. Fork-agnostic.
  let pbxprojPath = null;
  for (const entry of fs.readdirSync(iosDir, {withFileTypes: true})) {
    if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
      const p = path.join(iosDir, entry.name, 'project.pbxproj');
      if (fs.existsSync(p)) {
        pbxprojPath = p;
        break;
      }
    }
  }
  if (!pbxprojPath) return {pbxprojPath: null, blocks: candidates};
  const text = fs.readFileSync(pbxprojPath, 'utf8');
  // Match XCBuildConfiguration objects. Greedy-but-bounded by the
  // closing `};` that ends the object. pbxproj formatting is consistent
  // enough that this regex works on Xcode 14-26 output.
  const blockRe =
    /(\w{24})\s+\/\*\s+(Debug|Release)\s+\*\/\s+=\s+\{\s+isa = XCBuildConfiguration;[\s\S]*?\n\s+\};/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[0];
    const infoPlistMatch =
      /(?<![A-Z_])INFOPLIST_FILE\s+=\s+"?([^";]+)"?\s*;/.exec(block);
    if (!infoPlistMatch) continue;
    const infoPlistRelPath = infoPlistMatch[1];
    // Extension target plists in Xcode are named `<TargetName>-Info.plist`
    // (or sometimes `Info.plist` inside an `<Extension>/` directory we
    // already skip in findInfoPlistPath). The `-Info.plist` suffix is the
    // reliable marker. The main app's plist is just `<App>/Info.plist`.
    if (!infoPlistRelPath.endsWith('-Info.plist')) continue;
    const cpvMatch = /CURRENT_PROJECT_VERSION\s+=\s+([^;]+);/.exec(block);
    const mvMatch = /MARKETING_VERSION\s+=\s+([^;]+);/.exec(block);
    if (!cpvMatch || !mvMatch) continue;
    candidates.push({
      configName: m[2],
      configId: m[1],
      blockStart: m.index,
      blockEnd: m.index + block.length,
      infoPlistRelPath,
      currentProjectVersion: cpvMatch[1].trim(),
      marketingVersion: mvMatch[1].trim(),
    });
  }
  return {pbxprojPath, blocks: candidates};
}

function patchExtensionConfigBlocks(pbxprojPath, blocks, target) {
  // Rewrite the pbxproj once, patching each block in place. Going
  // back-to-front preserves the byte offsets of earlier blocks.
  let text = fs.readFileSync(pbxprojPath, 'utf8');
  const sorted = blocks.slice().sort((a, b) => b.blockStart - a.blockStart);
  for (const block of sorted) {
    let patched = text.slice(block.blockStart, block.blockEnd);
    if (block.marketingVersion !== target.semanticVersion) {
      patched = patched.replace(
        /MARKETING_VERSION\s+=\s+[^;]+;/,
        `MARKETING_VERSION = ${target.semanticVersion};`,
      );
    }
    if (block.currentProjectVersion !== target.buildNumber) {
      patched = patched.replace(
        /CURRENT_PROJECT_VERSION\s+=\s+[^;]+;/,
        `CURRENT_PROJECT_VERSION = ${target.buildNumber};`,
      );
    }
    text =
      text.slice(0, block.blockStart) + patched + text.slice(block.blockEnd);
  }
  fs.writeFileSync(pbxprojPath, text, 'utf8');
}

function readVersionFromAndroidGradle(repoRoot = REPO) {
  const p = path.join(repoRoot, 'android/app/build.gradle');
  if (!fs.existsSync(p)) {
    throw new Error(`Could not find ${p} — has \`expo prebuild\` run yet?`);
  }
  const text = fs.readFileSync(p, 'utf8');
  const versionName = /versionName\s+"([^"]+)"/.exec(text);
  const versionCode = /versionCode\s+(\d+)/.exec(text);
  if (!versionName || !versionCode) {
    throw new Error(`Could not parse version from ${p}`);
  }
  return {
    semanticVersion: versionName[1],
    buildNumber: versionCode[1],
    path: p,
  };
}

function patchInfoPlist(p, current, target) {
  let text = fs.readFileSync(p, 'utf8');
  if (current.semanticVersion !== target.semanticVersion) {
    text = text.replace(
      /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleShortVersionString</key>\n\t<string>${target.semanticVersion}</string>`,
    );
  }
  if (current.buildNumber !== target.buildNumber) {
    text = text.replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleVersion</key>\n\t<string>${target.buildNumber}</string>`,
    );
  }
  fs.writeFileSync(p, text, 'utf8');
}

function patchAndroidGradle(p, current, target) {
  let text = fs.readFileSync(p, 'utf8');
  if (current.semanticVersion !== target.semanticVersion) {
    text = text.replace(
      /versionName\s+"[^"]+"/,
      `versionName "${target.semanticVersion}"`,
    );
  }
  if (current.buildNumber !== target.buildNumber) {
    text = text.replace(
      /versionCode\s+\d+/,
      `versionCode ${target.buildNumber}`,
    );
  }
  fs.writeFileSync(p, text, 'utf8');
}

function main() {
  let truth;
  try {
    truth = readVersionFromGenerator();
  } catch (e) {
    console.error('FATAL: generate-version.js failed:', e.message);
    process.exit(2);
  }

  let ios = null;
  let iosExtensions = null;
  if (CHECK_IOS) {
    try {
      ios = readVersionFromInfoPlist(REPO);
      // Auto-discover Xcode extension targets and include each in the
      // check. Empty list (no extensions) is fine — means the project
      // ships only the main app and the SE/widget check is a no-op.
      iosExtensions = findExtensionConfigBlocks(REPO);
    } catch (e) {
      console.error('FATAL:', e.message);
      process.exit(2);
    }
  }

  let android = null;
  if (CHECK_ANDROID) {
    try {
      android = readVersionFromAndroidGradle(REPO);
    } catch (e) {
      console.error('FATAL:', e.message);
      process.exit(2);
    }
  }

  const truthPair = `${truth.semanticVersion}/${truth.buildNumber}`;
  const iosPair = ios ? `${ios.semanticVersion}/${ios.buildNumber}` : null;
  const androidPair = android
    ? `${android.semanticVersion}/${android.buildNumber}`
    : null;
  const iosMatch = !CHECK_IOS || iosPair === truthPair;
  // Extension targets agree when every discovered XCBuildConfiguration
  // block matches the source-of-truth (both Debug + Release for each
  // target). Drift in any one fails the check.
  const extensionMismatches = CHECK_IOS
    ? iosExtensions.blocks.filter(
        b =>
          b.marketingVersion !== truth.semanticVersion ||
          b.currentProjectVersion !== truth.buildNumber,
      )
    : [];
  const extensionsMatch = extensionMismatches.length === 0;
  const androidMatch = !CHECK_ANDROID || androidPair === truthPair;
  const allMatch = iosMatch && extensionsMatch && androidMatch;

  console.log(`Version sync check (platform=${PLATFORM}):`);
  console.log(
    `  Source of truth (app.config.ts via generate-version.js): ${truthPair}`,
  );
  if (CHECK_IOS) console.log(`  iOS ${ios.path}: ${iosPair}`);
  else console.log('  iOS: skipped (--platform=android)');
  if (CHECK_IOS && iosExtensions.blocks.length > 0) {
    for (const block of iosExtensions.blocks) {
      console.log(
        `  iOS extension ${iosExtensions.pbxprojPath} (${block.infoPlistRelPath} ${block.configName}): ${block.marketingVersion}/${block.currentProjectVersion}`,
      );
    }
  }
  if (CHECK_ANDROID) console.log(`  Android ${android.path}: ${androidPair}`);
  else console.log('  Android: skipped (--platform=ios)');

  if (allMatch) {
    console.log('\n✓ All checked sources agree.');
    process.exit(0);
  }

  if (FIX) {
    console.log('\n--fix: patching working tree to match source-of-truth…');
    if (CHECK_IOS && iosPair !== truthPair) {
      patchInfoPlist(ios.path, ios, truth);
      console.log(`  ✓ ${ios.path} → ${truthPair}`);
    }
    if (CHECK_IOS && extensionMismatches.length > 0) {
      patchExtensionConfigBlocks(
        iosExtensions.pbxprojPath,
        extensionMismatches,
        truth,
      );
      for (const block of extensionMismatches) {
        console.log(
          `  ✓ ${iosExtensions.pbxprojPath} ${block.infoPlistRelPath} ${block.configName} → ${truthPair}`,
        );
      }
    }
    if (CHECK_ANDROID && androidPair !== truthPair) {
      patchAndroidGradle(android.path, android, truth);
      console.log(`  ✓ ${android.path} → ${truthPair}`);
    }
    // Re-verify so we report the post-fix state authoritatively.
    const iosAfterPair = CHECK_IOS
      ? (() => {
          const a = readVersionFromInfoPlist(REPO);
          return `${a.semanticVersion}/${a.buildNumber}`;
        })()
      : null;
    const iosExtensionsAfter = CHECK_IOS
      ? findExtensionConfigBlocks(REPO)
      : null;
    const iosExtensionsOk = CHECK_IOS
      ? iosExtensionsAfter.blocks.every(
          b =>
            b.marketingVersion === truth.semanticVersion &&
            b.currentProjectVersion === truth.buildNumber,
        )
      : true;
    const androidAfterPair = CHECK_ANDROID
      ? (() => {
          const a = readVersionFromAndroidGradle(REPO);
          return `${a.semanticVersion}/${a.buildNumber}`;
        })()
      : null;
    const iosOk = !CHECK_IOS || iosAfterPair === truthPair;
    const androidOk = !CHECK_ANDROID || androidAfterPair === truthPair;
    if (iosOk && iosExtensionsOk && androidOk) {
      console.log('\n✓ Working tree now in sync.');
      console.log(
        'Standing rule: archive BEFORE committing the version sync. ' +
          'Committing first bumps the build count and re-introduces drift.',
      );
      process.exit(0);
    }
    console.error('\n✗ Patch failed — manual fix needed.');
    if (CHECK_IOS) console.error(`  iOS now: ${iosAfterPair}`);
    if (CHECK_ANDROID) console.error(`  Android now: ${androidAfterPair}`);
    process.exit(1);
  }

  console.error('\n✗ MISMATCH detected. Checked sources disagree.');
  if (CHECK_IOS && iosPair !== truthPair) {
    console.error(
      `  ${ios.path}\n    has    CFBundleShortVersionString=${ios.semanticVersion}, CFBundleVersion=${ios.buildNumber}` +
        `\n    needs  CFBundleShortVersionString=${truth.semanticVersion}, CFBundleVersion=${truth.buildNumber}`,
    );
  }
  if (CHECK_IOS && extensionMismatches.length > 0) {
    for (const block of extensionMismatches) {
      console.error(
        `  ${iosExtensions.pbxprojPath} (${block.infoPlistRelPath} ${block.configName})\n    has    MARKETING_VERSION=${block.marketingVersion}, CURRENT_PROJECT_VERSION=${block.currentProjectVersion}` +
          `\n    needs  MARKETING_VERSION=${truth.semanticVersion}, CURRENT_PROJECT_VERSION=${truth.buildNumber}`,
      );
    }
  }
  if (CHECK_ANDROID && androidPair !== truthPair) {
    console.error(
      `  ${android.path}\n    has    versionName "${android.semanticVersion}", versionCode ${android.buildNumber}` +
        `\n    needs  versionName "${truth.semanticVersion}", versionCode ${truth.buildNumber}`,
    );
  }
  // Don't suggest manual sed commands — naive `sed s|<string>X</string>|...|`
  // patterns match every <string>X</string> in the plist, not just the
  // CFBundleShortVersionString/CFBundleVersion entries. The auto-patcher
  // (--fix) uses a regex anchored on the CFBundle key to avoid that
  // collision. See PR #251 review.
  console.error(
    '\nResolve by re-running with --fix (auto-patches the working tree):',
  );
  console.error('  node scripts/verify-version-sync.js --fix');
  console.error(
    '\nThen archive. Do NOT commit the patch first — committing bumps the\n' +
      'git-rev-list commit count, re-introducing drift before archive.',
  );
  process.exit(1);
}

// Pure functions exported for unit testing — see scripts/__tests__/.
// `main()` and CLI argv parsing remain script-only.
module.exports = {
  findInfoPlistPath,
  readVersionFromInfoPlist,
  readVersionFromAndroidGradle,
  findExtensionConfigBlocks,
  patchInfoPlist,
  patchAndroidGradle,
  patchExtensionConfigBlocks,
  IOS_NON_APP_DIRS,
  IOS_NON_APP_SUFFIXES,
};

if (require.main === module) {
  main();
}
