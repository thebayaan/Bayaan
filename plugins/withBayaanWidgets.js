// plugins/withBayaanWidgets.js
// Fork seams for the native widgets (RFC-021). Everything here derives from
// app.config.js, so a fork changes its config, not the widget sources:
//   - URL scheme: `BayaanURLScheme` in the app Info.plist, the
//     `BAYAAN_URL_SCHEME` build setting the widget Info.plist expands, and
//     the `bayaan_widgets_url_scheme` Android string.
//   - App name: Android widget-picker labels that carry the brand ("Bayaan
//     Now"). Runtime copy reads the app label / CFBundleDisplayName instead.
//   - Enabled widgets: config/nativeWidgets.config.js `widgets` plus
//     config/featureFlags.ts (resolved by config/nativeWidgets.js). Both are
//     read lazily inside the mods, and config/branding.js is never loaded
//     (a fork's branding may require TS/TSX that Node cannot run). iOS gets BAYAAN_NO_WIDGET_* and
//     BAYAAN_NO_FEATURE_* Swift compilation conditions on the widget target
//     (none for the default config); Android gets `bayaan_widget_enabled_*`
//     and `bayaan_widgets_feature_*` booleans the library manifest and code read.
// The committed ios/ and android/ trees carry this plugin's default output.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {createRequire} = require('module');
const {
  IOSConfig,
  withDangerousMod,
  withFinalizedMod,
  withInfoPlist,
  createRunOncePlugin,
} = require('expo/config-plugins');
const {
  NATIVE_WIDGET_IDS,
  ANDROID_WIDGET_IDS,
  NATIVE_WIDGET_FEATURES,
  resolveNativeWidgets,
} = require('../config/nativeWidgets');

const WIDGET_TARGET = 'BayaanWidgetsExtension';
const DEFAULT_SCHEME = 'bayaan';
const DEFAULT_NAME = 'Bayaan';
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const ANDROID_VALUES_PATH = ['app', 'src', 'main', 'res', 'values'];
const ANDROID_VALUES_FILE = 'bayaan_widgets.xml';

/** The first `scheme` from app.config.js, or 'bayaan' when absent or invalid. */
function resolveScheme(config) {
  const raw = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (typeof raw === 'string' && SCHEME_PATTERN.test(raw)) return raw;
  if (raw !== undefined) {
    console.warn(
      `[withBayaanWidgets] scheme "${String(
        raw,
      )}" is not a valid URL scheme; widgets use "${DEFAULT_SCHEME}"`,
    );
  }
  return DEFAULT_SCHEME;
}

function resolveName(config) {
  const name = typeof config.name === 'string' ? config.name.trim() : '';
  return name || DEFAULT_NAME;
}

/** config/featureFlags.ts is TypeScript, so transpile it to read the flags. */
function readFeatureFlags(file) {
  const ts = require('typescript');
  const {outputText} = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  });
  const mod = {exports: {}};
  // Relative imports resolve from config/, as they would in the app.
  vm.runInNewContext(outputText, {
    module: mod,
    exports: mod.exports,
    require: createRequire(file),
  });
  const flags = mod.exports.featureFlags;
  if (!flags || typeof flags !== 'object') {
    throw new Error(`[withBayaanWidgets] ${file} does not export featureFlags`);
  }
  return flags;
}

function readWidgetList(file) {
  // A fresh read each time, so a long-lived `expo start` sees edits.
  delete require.cache[file];
  const {widgets} = require(file);
  if (widgets === undefined) return undefined;
  if (!Array.isArray(widgets)) {
    throw new Error(
      `[withBayaanWidgets] ${file}: \`widgets\` must be an array of widget ids or undefined`,
    );
  }
  const unknown = widgets.filter(id => !NATIVE_WIDGET_IDS.includes(id));
  if (unknown.length > 0) {
    console.warn(
      `[withBayaanWidgets] ${file}: ignoring unknown widget ids ${unknown.join(
        ', ',
      )} (known: ${NATIVE_WIDGET_IDS.join(', ')})`,
    );
  }
  return widgets;
}

/**
 * The fork seams this plugin reads besides app.config.js:
 * config/nativeWidgets.config.js (plain CJS) and config/featureFlags.ts.
 */
function loadForkSources(projectRoot) {
  const widgetsFile = path.resolve(
    projectRoot,
    'config',
    'nativeWidgets.config.js',
  );
  const flagsFile = path.resolve(projectRoot, 'config', 'featureFlags.ts');
  try {
    return {
      widgets: readWidgetList(widgetsFile),
      flags: readFeatureFlags(flagsFile),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[withBayaanWidgets] Could not read the widget seams (${widgetsFile}, ${flagsFile}): ${reason}`,
    );
  }
}

/**
 * @param config the Expo config (`name`, `scheme`)
 * @param sources `{widgets, flags}` from nativeWidgets.config.js and featureFlags.ts
 */
function resolveWidgetConfig(config, sources = {}) {
  const {enabled, features} = resolveNativeWidgets(
    sources.widgets,
    sources.flags,
  );
  return {
    scheme: resolveScheme(config),
    name: resolveName(config),
    enabled,
    features,
  };
}

function snakeCase(id) {
  return id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Swift conditions for what is off; empty for the default config. */
function compilationConditions(widgetConfig) {
  const widgets = NATIVE_WIDGET_IDS.filter(
    id => !widgetConfig.enabled.includes(id),
  ).map(id => `BAYAAN_NO_WIDGET_${snakeCase(id).toUpperCase()}`);
  const features = Object.keys(NATIVE_WIDGET_FEATURES)
    .filter(feature => !widgetConfig.features[feature])
    .map(feature => `BAYAAN_NO_FEATURE_${snakeCase(feature).toUpperCase()}`);
  return [...widgets, ...features];
}

/** Bayaan Now's gallery description, without the cards a fork turned off. */
function bayaanNowDescription(features) {
  const parts = [
    'listening',
    ...(features.adhkar ? ['adhkar'] : []),
    ...(features.sleepTimer ? ['bedtime'] : []),
  ];
  const last = parts.pop();
  return `What fits this moment: ${parts.join(', ')} or ${last}.`;
}

// ─── Xcode project (text edit, so the file's formatting is kept) ────────────

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSettingValue(value) {
  if (/^[A-Za-z0-9_$./]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
}

const SETTING_LINE = /^\t\t\t\t("?[A-Za-z0-9_[\]=*]+"?) = (.*);$/;

function settingName(line) {
  const match = SETTING_LINE.exec(line);
  return match ? match[1].replace(/"/g, '') : null;
}

/**
 * Applies `edit` to the buildSettings lines of every build configuration of
 * the named native target. `edit` receives and returns an array of lines.
 */
function editTargetBuildSettings(pbxproj, targetName, edit) {
  const listPattern = new RegExp(
    `\\t\\t[0-9A-Za-z]+ /\\* Build configuration list for PBXNativeTarget "${escapeRegExp(
      targetName,
    )}" \\*/ = \\{[\\s\\S]*?buildConfigurations = \\(([\\s\\S]*?)\\);`,
  );
  const list = listPattern.exec(pbxproj);
  if (!list) {
    throw new Error(
      `[withBayaanWidgets] No build configuration list for target "${targetName}" in project.pbxproj`,
    );
  }
  const ids = [...list[1].matchAll(/([0-9A-Za-z]+) \/\*/g)].map(m => m[1]);
  let out = pbxproj;
  for (const id of ids) {
    const start = out.search(
      new RegExp(
        `\\t\\t${id} /\\* [^*]+ \\*/ = \\{\\n\\t\\t\\tisa = XCBuildConfiguration;`,
      ),
    );
    if (start < 0) continue;
    const open = out.indexOf('buildSettings = {\n', start);
    const close = out.indexOf('\n\t\t\t};', open);
    if (open < 0 || close < 0) continue;
    const bodyStart = open + 'buildSettings = {\n'.length;
    const lines = out.slice(bodyStart, close).split('\n');
    const next = edit(lines);
    out = out.slice(0, bodyStart) + next.join('\n') + out.slice(close);
  }
  return out;
}

/** Sets (or, with value null, removes) a single-line build setting. */
function setBuildSetting(lines, name, value) {
  const index = lines.findIndex(line => settingName(line) === name);
  if (value === null) {
    return index < 0 ? lines : lines.filter((_, i) => i !== index);
  }
  const line = `\t\t\t\t${name} = ${formatSettingValue(value)};`;
  if (index >= 0) {
    const copy = [...lines];
    copy[index] = line;
    return copy;
  }
  // Keep Xcode's alphabetical order.
  const insertAt = lines.findIndex(existing => {
    const existingName = settingName(existing);
    return existingName !== null && existingName > name;
  });
  const copy = [...lines];
  copy.splice(insertAt < 0 ? copy.length : insertAt, 0, line);
  return copy;
}

const OWNED_CONDITION = /^BAYAAN_NO_/;

/**
 * Replaces this plugin's conditions in SWIFT_ACTIVE_COMPILATION_CONDITIONS,
 * keeping everything else (DEBUG, $(inherited)). Leaves the line untouched
 * when nothing changes, so the default config is a no-op.
 */
function setOwnedConditions(lines, conditions) {
  const name = 'SWIFT_ACTIVE_COMPILATION_CONDITIONS';
  const line = lines.find(l => settingName(l) === name);
  const current = line
    ? unquote(SETTING_LINE.exec(line)[2]).split(/\s+/).filter(Boolean)
    : [];
  const kept = current.filter(token => !OWNED_CONDITION.test(token));
  let next = kept;
  if (conditions.length > 0) {
    next = [...(kept.length > 0 ? kept : ['$(inherited)']), ...conditions];
  } else if (
    kept.length < current.length &&
    kept.join(' ') === '$(inherited)'
  ) {
    // Only the $(inherited) this plugin added is left.
    next = [];
  }
  if (next.join(' ') === current.join(' ')) return lines;
  if (next.length === 0) return setBuildSetting(lines, name, null);
  return setBuildSetting(lines, name, next.join(' '));
}

function applyWidgetBuildSettings(pbxproj, widgetConfig) {
  const conditions = compilationConditions(widgetConfig);
  return editTargetBuildSettings(pbxproj, WIDGET_TARGET, lines =>
    setOwnedConditions(
      setBuildSetting(lines, 'BAYAAN_URL_SCHEME', widgetConfig.scheme),
      conditions,
    ),
  );
}

// ─── Android resources ──────────────────────────────────────────────────────

function escapeXml(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
  // A leading @ or ? would make Android read the string as a reference.
  return /^[@?]/.test(escaped) ? `\\${escaped}` : escaped;
}

/** The app-module overrides for the bayaan-widgets library's defaults. */
function renderAndroidValues(widgetConfig) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- Generated by plugins/withBayaanWidgets.js (RFC-021) from app.config.js, config/branding.js and config/featureFlags.ts. Do not edit. -->',
    '<resources>',
    `  <string name="bayaan_widgets_url_scheme" translatable="false">${escapeXml(
      widgetConfig.scheme,
    )}</string>`,
    `  <string name="bayaan_widget_now_label">${escapeXml(
      `${widgetConfig.name} Now`,
    )}</string>`,
    `  <string name="bayaan_widget_now_desc">${escapeXml(
      bayaanNowDescription(widgetConfig.features),
    )}</string>`,
    ...ANDROID_WIDGET_IDS.map(
      id =>
        `  <bool name="bayaan_widget_enabled_${snakeCase(
          id,
        )}">${widgetConfig.enabled.includes(id)}</bool>`,
    ),
    ...Object.keys(NATIVE_WIDGET_FEATURES).map(
      feature =>
        `  <bool name="bayaan_widgets_feature_${snakeCase(feature)}">${
          widgetConfig.features[feature]
        }</bool>`,
    ),
    '</resources>',
    '',
  ].join('\n');
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

function withBayaanWidgets(config) {
  const projectRoot =
    (config._internal && config._internal.projectRoot) ||
    path.join(__dirname, '..');
  // The scheme needs no files; the widget list and flags are read only when
  // a native mod runs (prebuild), never on a plain config evaluation.
  const scheme = resolveScheme(config);
  let resolved = null;
  const widgetConfig = () => {
    if (!resolved) {
      resolved = resolveWidgetConfig(config, loadForkSources(projectRoot));
    }
    return resolved;
  };

  config = withInfoPlist(config, cfg => {
    cfg.modResults.BayaanURLScheme = scheme;
    return cfg;
  });

  // Finalized: @bacons/apple-targets rebuilds the widget target's build
  // configurations in its own Xcode mod, so this edit has to run after it.
  config = withFinalizedMod(config, [
    'ios',
    async cfg => {
      const file = IOSConfig.Paths.getPBXProjectPath(
        cfg.modRequest.projectRoot,
      );
      const before = fs.readFileSync(file, 'utf8');
      const after = applyWidgetBuildSettings(before, widgetConfig());
      if (after !== before) fs.writeFileSync(file, after);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        ...ANDROID_VALUES_PATH,
      );
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(
        path.join(dir, ANDROID_VALUES_FILE),
        renderAndroidValues(widgetConfig()),
      );
      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(
  withBayaanWidgets,
  'withBayaanWidgets',
  '1.0.0',
);
module.exports.resolveWidgetConfig = resolveWidgetConfig;
module.exports.applyWidgetBuildSettings = applyWidgetBuildSettings;
module.exports.renderAndroidValues = renderAndroidValues;
module.exports.compilationConditions = compilationConditions;
module.exports.loadForkSources = loadForkSources;
