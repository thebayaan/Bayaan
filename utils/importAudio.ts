import {Alert} from 'react-native';
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
    const recitation = await callbacks.importFile(files[0].uri, files[0].name);
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

  const recitations = await callbacks.importFiles(files);
  return recitations;
}
// @ai-end
