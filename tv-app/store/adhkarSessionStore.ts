// The app's adhkar session, on the real audio engine.
import {createAudioEngine} from '../services/audioEngine';
import {readJSON, writeJSON} from '../services/storage';
import {createAdhkarSessionStore} from './adhkarSessionController';

const AUTO_ADVANCE_KEY = 'adhkar.autoAdvance';

export const useAdhkarSessionStore = createAdhkarSessionStore({
  createEngine: createAudioEngine,
  loadAutoAdvance: () => readJSON<boolean>(AUTO_ADVANCE_KEY),
  saveAutoAdvance: on => writeJSON(AUTO_ADVANCE_KEY, on),
});
