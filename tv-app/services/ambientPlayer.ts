/**
 * ambientPlayer.ts: background ambience (rain, stream, ...) under the
 * recitation, on its own expo-audio player so it never touches the Quran
 * player. The sounds are the loops the phone app bundles
 * (assets/audio/ambient). Vega uses ambientPlayer.kepler.ts, which has none.
 */
import {createAudioPlayer, type AudioPlayer} from 'expo-audio';
import type {AmbientSound} from '../store/ambientStore';

/** Whether this platform can play ambience at all. */
export const AMBIENT_AVAILABLE = true;

const SOURCES: Record<AmbientSound, number> = {
  rain: require('../../assets/audio/ambient/rain.mp3'),
  forest: require('../../assets/audio/ambient/forest.mp3'),
  ocean: require('../../assets/audio/ambient/ocean.mp3'),
  stream: require('../../assets/audio/ambient/stream.mp3'),
  wind: require('../../assets/audio/ambient/wind.mp3'),
  fireplace: require('../../assets/audio/ambient/fireplace.mp3'),
};

const FADE_MS = 1200;
const FADE_STEP_MS = 60;

let player: AudioPlayer | null = null;
let loaded: AmbientSound | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let level = 0;

function clearFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function setLevel(value: number): void {
  level = value;
  try {
    if (player) player.volume = value;
  } catch {
    // The player may have been released.
  }
}

function fadeTo(target: number, then?: () => void): void {
  clearFade();
  const start = level;
  const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS));
  let step = 0;
  fadeTimer = setInterval(() => {
    step += 1;
    setLevel(start + (target - start) * Math.min(1, step / steps));
    if (step >= steps) {
      clearFade();
      then?.();
    }
  }, FADE_STEP_MS);
}

function ensure(sound: AmbientSound): AudioPlayer | null {
  if (player && loaded === sound) return player;
  try {
    if (player) {
      player.pause();
      player.replace(SOURCES[sound]);
    } else {
      player = createAudioPlayer(SOURCES[sound]);
    }
    player.loop = true;
    loaded = sound;
    setLevel(0);
    return player;
  } catch {
    return null;
  }
}

export const ambientPlayer = {
  /** Fades the sound in (switching sound first if needed). */
  start(sound: AmbientSound, volume: number): void {
    const p = ensure(sound);
    if (!p) return;
    try {
      p.play();
    } catch {
      return;
    }
    fadeTo(volume);
  },
  /** Fades out, then pauses. */
  stop(): void {
    if (!player) return;
    fadeTo(0, () => {
      try {
        player?.pause();
      } catch {
        // ignore
      }
    });
  },
  /** Changes the level of a sound that is already playing. */
  setVolume(volume: number): void {
    if (fadeTimer === null && player?.playing) setLevel(volume);
  },
};
