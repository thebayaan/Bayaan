import type {AyahTimestamp} from '../../types/timestamps';

const MP3QURAN_BASE = 'https://mp3quran.net/api/v3/ayat_timing';
const QDC_BASE = 'https://api.qurancdn.com/api/qdc/audio/reciters';

interface Mp3QuranEntry {
  ayah: number;
  start_time: number;
  end_time: number;
}

interface QdcResponse {
  audio_files?: Array<{
    verse_timings?: Array<{
      verse_key: string;
      timestamp_from: number;
      timestamp_to: number;
    }>;
  }>;
}

export async function fetchMp3QuranSurah(
  readId: number,
  surahNumber: number,
): Promise<AyahTimestamp[]> {
  const url = `${MP3QURAN_BASE}?read=${readId}&surah=${surahNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mp3quran ${res.status} for read=${readId} surah=${surahNumber}`);
  const raw = (await res.json()) as Mp3QuranEntry[];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map(e => ({
    surahNumber,
    ayahNumber: e.ayah,
    timestampFrom: e.start_time,
    timestampTo: e.end_time,
    durationMs: e.end_time - e.start_time,
  }));
}

export async function fetchQdcSurah(
  reciterId: number,
  surahNumber: number,
): Promise<AyahTimestamp[]> {
  const url = `${QDC_BASE}/${reciterId}/audio_files?chapter=${surahNumber}&segments=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`qdc ${res.status} for reciter=${reciterId} surah=${surahNumber}`);
  const json = (await res.json()) as QdcResponse;
  const timings = json.audio_files?.[0]?.verse_timings ?? [];
  if (timings.length === 0) return [];
  return timings.map(t => {
    const ayahNumber = parseInt(t.verse_key.split(':')[1], 10);
    return {
      surahNumber,
      ayahNumber,
      timestampFrom: t.timestamp_from,
      timestampTo: t.timestamp_to,
      durationMs: t.timestamp_to - t.timestamp_from,
    };
  });
}
