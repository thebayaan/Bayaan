/**
 * Keeps the ambience in step with the recitation: it sounds while the Quran
 * plays and the listener has it on, pauses with it, and follows a sleep
 * timer's fade. Started once, from the listening room module.
 */
import {AMBIENT_AVAILABLE, ambientPlayer} from './ambientPlayer';
import {ambientShouldPlay, useAmbientStore} from '../store/ambientStore';
import {SLEEP_FADE_MS, useTVPlayerStore} from '../store/tvPlayerStore';

let started = false;
let playing = false;
let playingSound: string | null = null;

function sleepFactor(): number {
  const sleep = useTVPlayerStore.getState().sleep;
  if (sleep.kind !== 'timer') return 1;
  const left = sleep.endsAt - Date.now();
  return left < SLEEP_FADE_MS ? Math.max(0, left / SLEEP_FADE_MS) : 1;
}

function apply(): void {
  const {enabled, currentSound, volume} = useAmbientStore.getState();
  const status = useTVPlayerStore.getState().status;
  const want = ambientShouldPlay(enabled, status, playing);
  if (want && (!playing || playingSound !== currentSound)) {
    ambientPlayer.start(currentSound, volume * sleepFactor());
    playing = true;
    playingSound = currentSound;
  } else if (!want && playing) {
    ambientPlayer.stop();
    playing = false;
  } else if (want) {
    ambientPlayer.setVolume(volume * sleepFactor());
  }
}

export function startAmbientSync(): void {
  if (started || !AMBIENT_AVAILABLE) return;
  started = true;
  useAmbientStore.subscribe(apply);
  useTVPlayerStore.subscribe((state, prev) => {
    if (state.status !== prev.status || state.sleep !== prev.sleep) apply();
  });
  // Follows the sleep timer's fade, which the player store does on its own.
  setInterval(() => {
    if (playing && useTVPlayerStore.getState().sleep.kind === 'timer') apply();
  }, 1000);
  apply();
}
