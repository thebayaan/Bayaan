module.exports = function (api) {
  api.cache(true);
  // Local config so the TV app does NOT inherit the parent app's babel.config.js.
  // The parent enables experiments.reactCompiler, whose output uses `#private`
  // syntax that the react-native-tvos 0.83 Hermes cannot parse. Resolving
  // babel-preset-expo against tv-app/app.json (no reactCompiler) keeps the
  // bundle Hermes-compatible on tvOS.
  return {
    presets: ['babel-preset-expo'],
  };
};
