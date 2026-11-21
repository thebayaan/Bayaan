import {Alert} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy'; // @ai
// @ai-start
import i18n from '@/i18n';
// @ai-end
import type {UploadedRecitation} from '@/types/uploads';

interface ImportCallbacks {
  importFile: (
    sourceUri: string,
    originalFilename: string,
  ) => Promise<UploadedRecitation>;
  importFiles: (
    files: Array<{uri: string; name: string}>,
  ) => Promise<UploadedRecitation[]>;
  onOrganize?: (recitation: UploadedRecitation) => void;
}

// @ai-start
/** A file path without its scheme, percent-escapes or iOS's /private alias. */
function plainPath(uri: string): string {
  let path = uri.replace(/^file:\/\//, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // Not escaped; compare it as it is.
  }
  return path.replace(/^\/private\//, '/');
}

/**
 * Deletes the temporary copy an import was made from, if it is in the app's
 * cache folder. The document picker (and, on Android, the share sheet) hands
 * the app a copy of the chosen file there, and importing copies it again into
 * the uploads folder. The first copy was never deleted, so every imported
 * file took its space twice. A source outside the cache folder is the user's
 * own file and is never touched.
 */
export async function deleteImportCacheCopy(sourceUri: string): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return;
  if (!plainPath(sourceUri).startsWith(plainPath(cacheDirectory))) return;
  await FileSystem.deleteAsync(sourceUri, {idempotent: true}).catch(
    () => undefined,
  );
}
// @ai-end

/**
 * Opens the document picker for audio files and imports the selected files.
 * Returns the imported recitations, or an empty array if cancelled.
 */
// @ai-start
export async function pickAndImportAudioFiles(
  callbacks: ImportCallbacks,
): Promise<UploadedRecitation[]> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac'],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return [];

  const files = result.assets.map(asset => ({
    uri: asset.uri,
    name: asset.name || 'Unknown',
  }));

  if (files.length === 1) {
    let recitation: UploadedRecitation;
    try {
      recitation = await callbacks.importFile(files[0].uri, files[0].name);
    } finally {
      // Imported or failed, the picker's copy has no further use.
      await deleteImportCacheCopy(files[0].uri);
    }
    Alert.alert(
      i18n.t('content:importAudio.fileImported'),
      recitation.originalFilename,
      [
        {text: i18n.t('common:actions.done')},
        ...(callbacks.onOrganize
          ? [
              {
                text: i18n.t('content:importAudio.editDetails'),
                onPress: () => callbacks.onOrganize!(recitation),
              },
            ]
          : []),
      ],
    );
    return [recitation];
  }

  try {
    const recitations = await callbacks.importFiles(files);
    return recitations;
  } finally {
    await Promise.all(files.map(file => deleteImportCacheCopy(file.uri)));
  }
}
// @ai-end
