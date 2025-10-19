import * as FileSystem from 'expo-file-system';
import { fetchAudioUrl } from './dataService'; // Adjust the path as needed

/**
 * Downloads a Surah MP3 for offline playback
 * @param surahId - The Surah number/id
 * @param reciterId - The reciter's ID
 * @param rewayatId - Optional: the rewayat ID (reading style)
 * @returns The local file path
 */
export async function downloadSurah(
  surahId: number,
  reciterId: string,
  rewayatId?: string,
): Promise<string> {
  //  Get the remote URL using the data service
  const remoteUrl = await fetchAudioUrl(surahId, reciterId, rewayatId);

  // Decide local file path (you can add reciter/rewayat to avoid conflicts)
  const padded = surahId.toString().padStart(3, '0');
  const fileName = rewayatId
    ? `${padded}_${reciterId}_${rewayatId}.mp3`
    : `${padded}_${reciterId}.mp3`;
  const localPath = `${FileSystem.documentDirectory}${fileName}`;

  // Check if file already exists
  const fileInfo = await FileSystem.getInfoAsync(localPath);
  if (!fileInfo.exists) {
    console.log(`Downloading Surah ${surahId}...`);
    await FileSystem.downloadAsync(remoteUrl, localPath);
    console.log('Download complete:', localPath);
  } else {
    console.log('File already exists:', localPath);
  }

  return localPath;
}


async function getAllDownloadedFiles() {
  try {
    if (!FileSystem.documentDirectory) {
      console.error('Document directory is not available.');
      return [];
    }
    const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    console.log('Downloaded files:', files);
    return files; // Array of file names like ['001.mp3', '002.mp3']
  } catch (error) {
    console.error('Error reading downloaded files:', error);
    return [];
  }
}