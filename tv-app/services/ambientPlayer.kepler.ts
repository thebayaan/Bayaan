/**
 * Vega (Fire TV) has no ambience yet: the W3C media player there needs the
 * loops hosted rather than bundled. AMBIENT_AVAILABLE hides the Sound control,
 * the Settings row and the footer chip.
 */
import type {AmbientSound} from '../store/ambientStore';

export const AMBIENT_AVAILABLE = false;

export const ambientPlayer = {
  start(_sound: AmbientSound, _volume: number): void {},
  stop(): void {},
  setVolume(_volume: number): void {},
};
