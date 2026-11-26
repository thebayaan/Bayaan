import * as FileSystem from 'expo-file-system/legacy';
import {ensureSecondLookModel} from '../recitationAssets';

// The files Tilawa 1.0 needs, downloaded by the app itself rather than by the SDK:
// its default storage on React Native keeps the model in memory only (a fresh
// download every launch) and checks no checksum. Pinned files at fixed URLs, checked
// by size as the 0.4 files are. The SDK is then handed the model and the reference,
// so it fetches nothing.
//
// - The listener, spliced-clean@1-int8 (the full tier; React Native's `auto` would
//   pick the lite one, which leaves about six times the false marks after our
//   check): CC BY 4.0, from Tilawa's models-v1 release.
// - Its Quran reference, ref-v2 (Tanzil text through quran-transcript), from the
//   1.0.0-rc.0 tag; the SDK's 1.0.0-rc.1 has no tag and ships the same file. It
//   names the words that marks and places point at.
//
// The second look's model (quran-asr-small) checks every mark this engine raises,
// so it is part of this download too.

export const V1_MODEL = {
  url: 'https://github.com/yazinsai/tilawa/releases/download/models-v1/spliced-clean-1-int8.onnx',
  file: 'spliced-clean-1-int8.onnx',
  bytes: 67759744,
  sha256: '714e98addee73b1b8781ad7d99b6d3c745acd9116638baf4e12891f53a15af1b',
} as const;

export const V1_REFERENCE = {
  url: 'https://raw.githubusercontent.com/yazinsai/tilawa/v1.0.0-rc.0/packages/core/assets/ref-v2.json',
  file: 'ref-v2.json',
  bytes: 4749281,
  sha256: 'f236384ea91e81ad554ba2777bc4073c3ff41e34120343a8a474571c577b7727',
} as const;

const ASSET_DIR = 'recitation/v1/';

/** Tilawa 1.0's two files, as the UI states them (the second model comes on top). */
export const V1_DOWNLOAD_MB = Math.round(
  (V1_MODEL.bytes + V1_REFERENCE.bytes) / 1e6,
);

export interface V1AssetPaths {
  modelPath: string;
  referencePath: string;
}

function assetUri(file: string): string {
  return `${FileSystem.documentDirectory}${ASSET_DIR}${file}`;
}

async function hasFile(uri: string, bytes: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory && info.size === bytes;
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

/** Both of Tilawa 1.0's files at their pinned sizes, or null. */
export async function getV1Assets(): Promise<V1AssetPaths | null> {
  const modelPath = assetUri(V1_MODEL.file);
  const referencePath = assetUri(V1_REFERENCE.file);
  const ready =
    (await hasFile(modelPath, V1_MODEL.bytes)) &&
    (await hasFile(referencePath, V1_REFERENCE.bytes));
  return ready ? {modelPath, referencePath} : null;
}

/**
 * Downloads what is missing: the reference, the listener, then the second look's
 * model, which this engine cannot do without.
 * @param onProgress - Progress of Tilawa's two files, 0 to 1
 */
export async function ensureV1Assets(
  onProgress: (progress: number) => void,
): Promise<V1AssetPaths> {
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}${ASSET_DIR}`,
    {intermediates: true},
  );
  const total = V1_REFERENCE.bytes + V1_MODEL.bytes;
  let referenceWritten = 0;
  await downloadTo(
    V1_REFERENCE.url,
    assetUri(V1_REFERENCE.file),
    V1_REFERENCE.bytes,
    n => {
      referenceWritten = n;
      onProgress(n / total);
    },
  );
  await downloadTo(V1_MODEL.url, assetUri(V1_MODEL.file), V1_MODEL.bytes, n =>
    onProgress((referenceWritten + n) / total),
  );
  await ensureSecondLookModel();
  return {
    modelPath: assetUri(V1_MODEL.file),
    referencePath: assetUri(V1_REFERENCE.file),
  };
}

export async function deleteV1Assets(): Promise<void> {
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${ASSET_DIR}`, {
    idempotent: true,
  });
}
