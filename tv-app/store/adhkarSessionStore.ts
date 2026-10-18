// The app's adhkar session, on the real audio engine.
import {createAudioEngine} from '../services/audioEngine';
import {readJSON, writeJSON} from '../services/storage';
import {
  createAdhkarSessionStore,
  type LeftSession,
} from './adhkarSessionController';
import {showToast} from './toastStore';

const AUTO_ADVANCE_KEY = 'adhkar.autoAdvance';
const LEFT_KEY = 'adhkar.left';

export const useAdhkarSessionStore = createAdhkarSessionStore({
  createEngine: createAudioEngine,
  loadAutoAdvance: () => readJSON<boolean>(AUTO_ADVANCE_KEY),
  saveAutoAdvance: on => writeJSON(AUTO_ADVANCE_KEY, on),
  loadLeft: () => readJSON<Record<string, LeftSession>>(LEFT_KEY),
  saveLeft: left => writeJSON(LEFT_KEY, left),
  notify: message => showToast(message),
});
