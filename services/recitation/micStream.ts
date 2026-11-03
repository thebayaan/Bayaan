import {Platform} from 'react-native';
import {AudioManager, AudioRecorder} from 'react-native-audio-api';
import {RECITATION_SAMPLE_RATE} from './recitationEngine';

// ~480 ms per chunk, the cadence Tilawa recommends.
const CHUNK_SAMPLES = 7680;

export interface MicStream {
  stop: () => Promise<void>;
  /** Brings the mic back after an interruption; throws if it cannot. */
  resume: () => Promise<void>;
}

/** A call, Siri or another app took the audio session, or gave it back. */
export type InterruptionPhase = 'began' | 'ended';

/** Linear resample to 16 kHz for devices that ignore the requested rate. */
function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === RECITATION_SAMPLE_RATE) return input;
  const ratio = fromRate / RECITATION_SAMPLE_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
}

export async function requestMicPermission(): Promise<boolean> {
  const status = await AudioManager.requestRecordingPermissions();
  return status === 'Granted';
}

function configureRecordingSession(): void {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    // 'measurement' disables input gain, which left speech under Tilawa's
    // silence gate on device.
    iosMode: 'default',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
  });
}

/**
 * Streams mono 16 kHz PCM chunks from the microphone.
 * @param onChunk - Receives each chunk plus the device's actual sample rate
 * @param onInterruption - An interruption began (the recorder stops) or
 *   ended (call resume() to listen again)
 */
export async function startMicStream(
  onChunk: (pcm: Float32Array, deviceRate: number) => void,
  onInterruption: (phase: InterruptionPhase) => void = () => undefined,
): Promise<MicStream> {
  configureRecordingSession();
  await AudioManager.setAudioSessionActivity(true);

  const recorder = new AudioRecorder();
  const callbackResult = recorder.onAudioReady(
    {
      sampleRate: RECITATION_SAMPLE_RATE,
      bufferLength: CHUNK_SAMPLES,
      channelCount: 1,
    },
    ({buffer}) => {
      const rate = buffer.sampleRate;
      onChunk(resampleTo16k(buffer.getChannelData(0), rate), rate);
    },
  );
  if (callbackResult.status === 'error') {
    throw new Error(callbackResult.message);
  }
  const startResult = await recorder.start();
  if (startResult.status === 'error') {
    recorder.clearOnAudioReady();
    throw new Error(startResult.message);
  }

  // The recorder stops silently on an interruption. On Android this also
  // takes audio focus, so other apps stop playing into the mic.
  AudioManager.observeAudioInterruptions(
    Platform.OS === 'android' ? 'gainTransientExclusive' : true,
  );
  const interruption = AudioManager.addSystemEventListener(
    'interruption',
    event => onInterruption(event.type),
  );

  // Set by stop(): a resume still waiting on the audio session must not
  // reopen the mic after it.
  let stopped = false;

  return {
    async resume() {
      configureRecordingSession();
      await AudioManager.setAudioSessionActivity(true);
      if (stopped) return;
      // The interruption may have left the recorder stopped or half running;
      // a stop then a start works from either.
      await recorder.stop();
      if (stopped) return;
      const result = await recorder.start();
      if (result.status === 'error') throw new Error(result.message);
      if (stopped) await recorder.stop();
    },
    async stop() {
      stopped = true;
      interruption?.remove();
      AudioManager.observeAudioInterruptions(false);
      recorder.clearOnAudioReady();
      await recorder.stop();
      // Hand the shared session back in the shape expo-audio set at init, so
      // Quran playback isn't left in record mode or deactivated.
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
        iosOptions: [],
      });
    },
  };
}
