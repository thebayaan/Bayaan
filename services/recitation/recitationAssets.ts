import * as FileSystem from 'expo-file-system/legacy';
import {SECOND_LOOK_ENABLED} from './secondLook/config';

// Tilawa (github.com/yazinsai/tilawa) model + phoneme corpus. Both are
// NPL-1.2 (licenses/NPL-1.2.txt): free to use, never behind a payment,
// derivatives stay NPL-1.2. Pulled from the GitHub releases for now; an R2
// mirror must serve licenses/NPL-1.2.txt beside the files.
const MODEL_URL =
  'https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.int8.onnx';
const CORPUS_URL =
  'https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_quran.json';
// The second look's model, quran-asr-small, at a pinned revision. MIT
// (licenses/quran-asr-small-MIT.txt). The follower does not need it: without it
// marks show unchecked.
const SECOND_LOOK_URL =
  'https://huggingface.co/Abdou/quran-asr-small/resolve/004f898639f3127a74eac1b898a2cb3ef0b5268d/model.int8.onnx';

const ASSET_DIR = 'recitation/';
const MODEL_FILE = 'zipformer_a0w_ep1_a05.int8.onnx';
const CORPUS_FILE = 'zipformer_quran.json';
const SECOND_LOOK_FILE = 'quran-asr-small.int8.onnx';

// Sizes of the pinned release files, used to reject truncated downloads.
const MODEL_BYTES = 69246033;
const CORPUS_BYTES = 5453439;
const SECOND_LOOK_BYTES = 36081762;

export interface RecitationAssetPaths {
  modelPath: string;
  corpusPath: string;
}

function assetUri(file: string): string {
  return `${FileSystem.documentDirectory}${ASSET_DIR}${file}`;
}

async function hasFile(uri: string, bytes: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory && info.size === bytes;
}

export async function getRecitationAssets(): Promise<RecitationAssetPaths | null> {
  const modelUri = assetUri(MODEL_FILE);
  const corpusUri = assetUri(CORPUS_FILE);
  const ready =
    (await hasFile(modelUri, MODEL_BYTES)) &&
    (await hasFile(corpusUri, CORPUS_BYTES));
  if (!ready) return null;
  return {modelPath: modelUri, corpusPath: corpusUri};
}

async function downloadTo(
  url: string,
  uri: string,
  bytes: number,
  onProgress?: (written: number) => void,
): Promise<void> {
  if (await hasFile(uri, bytes)) {
    onProgress?.(bytes);
    return;
  }
  const task = FileSystem.createDownloadResumable(url, uri, {}, data =>
    onProgress?.(data.totalBytesWritten),
  );
  const result = await task.downloadAsync();
  if (!result || result.status !== 200 || !(await hasFile(uri, bytes))) {
    await FileSystem.deleteAsync(uri, {idempotent: true});
    throw new Error(`Download failed: ${url}`);
  }
}

async function makeAssetDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}${ASSET_DIR}`,
    {intermediates: true},
  );
}

// The second look's download in progress, shared by whoever asks.
let secondLookDownload: Promise<void> | null = null;

function downloadSecondLook(): Promise<void> {
  secondLookDownload ??= downloadTo(
    SECOND_LOOK_URL,
    assetUri(SECOND_LOOK_FILE),
    SECOND_LOOK_BYTES,
  ).finally(() => {
    secondLookDownload = null;
  });
  return secondLookDownload;
}

/**
 * Downloads the follower's corpus and model if missing, and starts the second
 * look's model beside the follower's (~111 MB in all). It waits only for the
 * follower's files, and only they can fail it: the follower does not need the
 * second model, and on iOS a download that cannot reach its server stays pending
 * for days. Side by side, on a working network the smaller file arrives first, so
 * the first take has it. If it does not, that take goes without.
 * @param onProgress - Progress of the follower's files, 0 to 1
 */
export async function ensureRecitationAssets(
  onProgress: (progress: number) => void,
): Promise<RecitationAssetPaths> {
  await makeAssetDir();
  const total = MODEL_BYTES + CORPUS_BYTES;
  let corpusWritten = 0;
  await downloadTo(CORPUS_URL, assetUri(CORPUS_FILE), CORPUS_BYTES, n => {
    corpusWritten = n;
    onProgress(n / total);
  });
  if (SECOND_LOOK_ENABLED) {
    downloadSecondLook().catch(error => {
      console.warn('[recitation] could not download the second model', error);
    });
  }
  await downloadTo(MODEL_URL, assetUri(MODEL_FILE), MODEL_BYTES, n =>
    onProgress((corpusWritten + n) / total),
  );
  return {modelPath: assetUri(MODEL_FILE), corpusPath: assetUri(CORPUS_FILE)};
}

/** The second look's model on disk, or null when it is missing. */
export async function secondLookModelPath(): Promise<string | null> {
  const uri = assetUri(SECOND_LOOK_FILE);
  return (await hasFile(uri, SECOND_LOOK_BYTES)) ? uri : null;
}

/**
 * Downloads the second look's model alone, for an install that has the
 * follower's files from before it, or joins the download already under way.
 * Rejects if the download fails.
 */
export async function ensureSecondLookModel(): Promise<void> {
  await makeAssetDir();
  await downloadSecondLook();
}

export async function deleteRecitationAssets(): Promise<void> {
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${ASSET_DIR}`, {
    idempotent: true,
  });
}
