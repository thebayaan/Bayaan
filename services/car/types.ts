/** Bundled icon tiles (the app's Collection icons). 'playlist' is drawn on `hex`. */
export type CarIconName =
  | 'loved'
  | 'playlists'
  | 'downloads'
  | 'uploads'
  | 'reciters'
  | 'random'
  | 'playlist';

export type CarArtwork =
  | {kind: 'surah'; surahId: number}
  | {kind: 'icon'; name: CarIconName; hex?: string}
  | {kind: 'url'; url: string}
  | {kind: 'asset'; uri: string}
  | {kind: 'monogram'; label: string; hex: string}
  | {kind: 'color'; label: string; hex: string};

export type CarPlayRequest =
  | {
      kind: 'surah';
      reciterId: string;
      rewayatId: string;
      surahId: number;
      startAt?: number;
    }
  | {kind: 'playlist'; playlistId: string; system: boolean; startIndex?: number}
  | {kind: 'loved'; shuffle?: boolean; startIndex?: number}
  | {kind: 'downloads'; startIndex?: number}
  | {kind: 'uploads'; startIndex?: number}
  /** Without `recitationId`, the first Jump back in entry; with it, that upload's entry. */
  | {kind: 'resume'; recitationId?: string}
  /** Random Recitation, the same picks as the phone's Home card. */
  | {kind: 'random'};

export type CarBrowseTarget =
  | {kind: 'list'; listId: string}
  | {kind: 'reciter'; reciterId: string}
  | {kind: 'surahReciters'; surahId: number};

export type CarItemAction =
  | {kind: 'play'; request: CarPlayRequest}
  | {kind: 'browse'; target: CarBrowseTarget};

export interface CarItem {
  id: string;
  title: string;
  subtitle?: string;
  artwork: CarArtwork;
  progress?: number;
  /** Length in seconds, so CarPlay can show the time left with progress. */
  duration?: number;
  isDownloaded?: boolean;
  action: CarItemAction;
}

export type CarSectionStyle = 'rows' | 'cards' | 'circles';

export interface CarSection {
  id: string;
  title: string;
  style: CarSectionStyle;
  items: CarItem[];
}

export interface CarList {
  id: string;
  title: string;
  items: CarItem[];
}

export interface CarRewayah {
  id: string;
  name: string;
  style: string;
  surahIds: number[];
}

export interface CarReciter {
  id: string;
  name: string;
  artwork: CarArtwork;
  isFavorite: boolean;
  rewayat: CarRewayah[];
}

export interface CarSurah {
  id: number;
  name: string;
  nameArabic: string;
  translation: string;
  versesCount: number;
}

export interface CarSnapshot {
  version: 1;
  generatedAt: string;
  topReciterId: string | null;
  home: {sections: CarSection[]};
  library: CarItem[];
  lists: Record<string, CarList>;
  reciters: CarReciter[];
  surahs: CarSurah[];
  /** `title` covers juz that start no surah: "Juz 1–2". */
  juz: {number: number; title: string; surahIds: number[]}[];
  downloadedKeys: string[];
  /** https base for surah cards, ending in '/'. Natives fall back to Bayaan's CDN when absent. */
  surahArtworkBase?: string;
}

export type CarTransport =
  | {kind: 'next'}
  | {kind: 'previous'}
  | {kind: 'play'}
  | {kind: 'pause'}
  | {kind: 'seek'; position: number}
  | {kind: 'rate'; value: number}
  | {kind: 'cycleRate'}
  | {kind: 'cycleRepeat'}
  | {kind: 'toggleLove'}
  | {kind: 'jumpTo'; index: number};

export interface CarNowPlaying {
  title: string;
  subtitle: string;
  reciterId: string | null;
  surahId: number | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  repeatMode: 'none' | 'queue' | 'track';
  isLoved: boolean;
  artwork: CarArtwork | null;
  queue: {title: string; subtitle: string; surahId: number | null}[];
  currentIndex: number;
}

export function downloadKey(
  reciterId: string,
  rewayatId: string,
  surahId: number,
): string {
  return `${reciterId}:${rewayatId}:${surahId}`;
}
