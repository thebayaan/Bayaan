// React Native on Vega defines a minimal `process.env` global at startup
// (Libraries/Core/setUpGlobals); shared code reads optional EXPO_PUBLIC_* keys.
declare const process: {env: Record<string, string | undefined>};
