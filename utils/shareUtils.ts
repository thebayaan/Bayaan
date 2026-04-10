import {Share, Platform} from 'react-native';

const BASE_URL = 'https://app.thebayaan.com';

export function reciterShareUrl(slugOrId: string): string {
  return `${BASE_URL}/share/reciter/${slugOrId}`;
}

export function surahShareUrl(slugOrId: string, surahNum: number): string {
  return `${BASE_URL}/share/reciter/${slugOrId}/surah/${surahNum}`;
}

export function mushafShareUrl(page: number): string {
  return `${BASE_URL}/share/mushaf/${page}`;
}

export function adhkarShareUrl(superId: string | number): string {
  return `${BASE_URL}/share/adhkar/${superId}`;
}

export function playlistShareUrl(id: string): string {
  return `${BASE_URL}/share/playlist/${id}`;
}

export async function shareUrl(url: string, message: string): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Share.share({url, message});
    } else {
      // Android: message + URL concatenated (url param is iOS-only in RN Share)
      await Share.share({message: `${message}\n${url}`});
    }
  } catch {
    // User dismissed or share failed — no action needed
  }
}
