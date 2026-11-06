/**
 * Fork seam (RFC-021): which native widget surfaces this build ships.
 *
 * Plain CommonJS with no imports, on purpose: plugins/withBayaanWidgets.js
 * reads it in Node at prebuild, and services/widgets reads it at runtime.
 * Keep it that way (no require of TS/TSX, no app code).
 *
 * `widgets: undefined` (Bayaan's default) ships every surface. A fork lists
 * the ids it wants; feature flags in config/featureFlags.ts still apply on
 * top (see config/nativeWidgets.js). Unknown ids are ignored with a warning
 * at prebuild. Changing this needs a new native build.
 *
 * @example
 * module.exports = {
 *   widgets: ['ContinueListening', 'QuickSurah', 'AyahOfTheDay', 'LiveActivity'],
 * };
 *
 * See docs/rfcs/021-native-widget-seams.md.
 */
module.exports = {
  widgets: undefined,
};
