/* eslint-env node, es2020 */
// The app's native and far-off edges, for the replay: nothing here decides anything.
export const AppState = {
  addEventListener: () => ({remove: () => undefined}),
};
export const Platform = {OS: 'ios'};
export const notificationAsync = async () => undefined;
export const NotificationFeedbackType = {Warning: 'warning'};
export const useMushafSettingsStore = {
  getState: () => ({
    recitationHideText: false,
    recitationMistakeHaptics: true,
    recitationCheckMistakes: true,
  }),
};
const quiet = new Proxy({}, {get: () => () => undefined});
export const analyticsService = quiet;
export const usePlayerStore = {
  getState: () => ({playback: {state: 'paused'}, pause: () => undefined}),
};
export const useMushafPlayerStore = {
  getState: () => ({playbackState: 'idle', stop: () => undefined}),
};
export const digitalKhattDataService = {
  getVerseWords: () => [],
  tryGetVerseText: () => null,
};
export const recitationLogDatabase = {
  recordTake: async () => undefined,
  dismissedKeys: async () => new Set(),
  dismissWord: async () => undefined,
};
export default {t: key => key};

// The trace goes to the replay, and the take's audio to nowhere.
export const trace = line => globalThis.__repro.trace(line);
export const debugTakeStart = () => undefined;
export const debugTakeAudio = () => undefined;
export const debugTakeSave = async () => undefined;

// The mic: the replay hands the chunks over.
export const requestMicPermission = async () => true;
export const startMicStream = async onChunk => {
  globalThis.__repro.mic = onChunk;
  return {stop: async () => undefined, resume: async () => undefined};
};

// The files.
export const getRecitationAssets = async () => globalThis.__repro.assets;
export const readAsStringAsync = async file =>
  globalThis.__repro.readFile(file);
export const ensureRecitationAssets = async () => getRecitationAssets();
export const deleteRecitationAssets = async () => undefined;
export const secondLookModelPath = async () => globalThis.__repro.modelFile;
export const ensureSecondLookModel = async () => undefined;

// The second model: real, and as slow as the replay says.
export const InferenceSession = {
  create: (...args) => globalThis.__repro.createSession(...args),
};
export const Tensor = globalThis.__repro.Tensor;

// The follower: its recorded verdicts (engine.mjs).
export const RECITATION_SAMPLE_RATE = 16000;
export const createRecitationEngine = async (_assets, onEvent) =>
  globalThis.__repro.createEngine(onEvent);
