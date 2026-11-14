// Development builds only: a running trace of what follow-along decided, in
// the Metro log, and each take's audio saved on the phone as a 16 kHz WAV
// (Documents/recitation-debug/) so it can be copied to a Mac and replayed
// through scripts/recitation-bench. Nothing here runs in release builds or
// tests, and nothing leaves the phone unless a developer copies it off.

const ON = __DEV__ && process.env.NODE_ENV !== 'test';
const SAMPLE_RATE = 16000;
const MAX_SECONDS = 600;

let startedAt = 0;
let chunks: Int16Array[] = [];
let samples = 0;

/** A take began: restart the trace clock and the recording. */
export function debugTakeStart(): void {
  if (!ON) return;
  startedAt = Date.now();
  chunks = [];
  samples = 0;
}

/** One line in the Metro log, stamped with seconds since the take began. */
export function trace(line: string): void {
  if (!ON) return;
  const t = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`[recitation ${t}s] ${line}`);
}

/** A chunk the engine heard (16 kHz mono float). */
export function debugTakeAudio(pcm: Float32Array): void {
  if (!ON || samples >= MAX_SECONDS * SAMPLE_RATE) return;
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  chunks.push(out);
  samples += out.length;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let line = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    line +=
      B64[a >> 2] +
      B64[((a & 3) << 4) | (b >> 4)] +
      (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') +
      (i + 2 < bytes.length ? B64[c & 63] : '=');
    if (line.length >= 8192) {
      parts.push(line);
      line = '';
    }
  }
  parts.push(line);
  return parts.join('');
}

function wav(): Uint8Array {
  const dataBytes = samples * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  let at = 44;
  for (const chunk of chunks) {
    bytes.set(
      new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      at,
    );
    at += chunk.byteLength;
  }
  return bytes;
}

/** The take ended: save its audio as Documents/recitation-debug/<name>.wav. */
export async function debugTakeSave(name: string): Promise<void> {
  if (!ON || samples === 0) return;
  try {
    const FileSystem = require('expo-file-system/legacy');
    const dir = `${FileSystem.documentDirectory}recitation-debug/`;
    await FileSystem.makeDirectoryAsync(dir, {intermediates: true});
    await FileSystem.writeAsStringAsync(`${dir}${name}.wav`, base64(wav()), {
      encoding: FileSystem.EncodingType.Base64,
    });
    trace(
      `saved take audio ${name}.wav (${(samples / SAMPLE_RATE).toFixed(1)} s)`,
    );
  } catch (error) {
    console.warn('[recitation] could not save take audio', error);
  } finally {
    chunks = [];
    samples = 0;
  }
}
