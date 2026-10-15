import * as FileSystem from 'expo-file-system/legacy';

// Tilawa (github.com/yazinsai/tilawa) model + phoneme corpus. Both are
// NPL-1.2 (licenses/NPL-1.2.txt): free to use, never behind a payment,
// derivatives stay NPL-1.2. Pulled from the GitHub releases for now; an R2
// mirror must serve licenses/NPL-1.2.txt beside the files.
const MODEL_URL =
  'https://github.com/yazinsai/tilawa/releases/download/zipformer-a0w-ep1-a0.5/zipformer_a0w_ep1_a05.int8.onnx';
const CORPUS_URL =
  'https://github.com/yazinsai/tilawa/releases/download/v0.3.0/zipformer_quran.json';

const ASSET_DIR = 'recitation/';
const MODEL_FILE = 'zipformer_a0w_ep1_a05.int8.onnx';
const CORPUS_FILE = 'zipformer_quran.json';

// Sizes of the pinned release files, used to reject truncated downloads.
const MODEL_BYTES = 69246033;
const CORPUS_BYTES = 5453439;

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
  onProgress: (written: number) => void,
): Promise<void> {
  if (await hasFile(uri, bytes)) {
    onProgress(bytes);
    return;
  }
  const task = FileSystem.createDownloadResumable(url, uri, {}, data =>
    onProgress(data.totalBytesWritten),
  );
  const result = await task.downloadAsync();
  if (!result || result.status !== 200 || !(await hasFile(uri, bytes))) {
    await FileSystem.deleteAsync(uri, {idempotent: true});
    throw new Error(`Download failed: ${url}`);
  }
}

/**
 * Downloads the model and corpus (~75 MB) if missing.
 * @param onProgress - Combined progress, 0 to 1
 */
export async function ensureRecitationAssets(
  onProgress: (progress: number) => void,
): Promise<RecitationAssetPaths> {
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}${ASSET_DIR}`,
    {intermediates: true},
  );
  const total = MODEL_BYTES + CORPUS_BYTES;
  let corpusWritten = 0;
  await downloadTo(CORPUS_URL, assetUri(CORPUS_FILE), CORPUS_BYTES, n => {
    corpusWritten = n;
    onProgress(n / total);
  });
  await downloadTo(MODEL_URL, assetUri(MODEL_FILE), MODEL_BYTES, n =>
    onProgress((corpusWritten + n) / total),
  );
  return {modelPath: assetUri(MODEL_FILE), corpusPath: assetUri(CORPUS_FILE)};
}

export async function deleteRecitationAssets(): Promise<void> {
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${ASSET_DIR}`, {
    idempotent: true,
  });
}
