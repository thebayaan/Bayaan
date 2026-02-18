/**
 * Mushaf Audio Utilities
 *
 * Resolves audio URLs for mushaf playback, using the same TIMESTAMP_AUDIO_OVERRIDES
 * from audioUtils.ts to ensure timestamp-aligned audio.
 */

// Re-export the TIMESTAMP_AUDIO_OVERRIDES from audioUtils for direct access
// We import the generateAudioUrl function to reuse the override logic
import {RECITERS, type Reciter} from '@/data/reciterData';

// Mirror of TIMESTAMP_AUDIO_OVERRIDES from audioUtils.ts
// These overrides ensure audio URLs match the timestamps in the DB
const TIMESTAMP_AUDIO_OVERRIDES: Record<
  string,
  {baseUrl: string; padded: boolean}
> = {
  '57f8ce9e-759e-4880-9f96-21d34c992159': {
    baseUrl: 'https://download.quranicaudio.com/qdc/abdul_baset/mujawwad',
    padded: false,
  },
  'bb419980-eb6d-4c83-bf30-21303d417e9b': {
    baseUrl: 'https://download.quranicaudio.com/qdc/abdul_baset/murattal',
    padded: false,
  },
  '88b69153-00ce-4d7c-a17a-c2e5f3ae4f52': {
    baseUrl: 'https://download.quranicaudio.com/quran/abdul_muhsin_alqasim',
    padded: true,
  },
  '7603c062-b103-4959-b4d1-dfc2fd437ae9': {
    baseUrl: 'https://download.quranicaudio.com/quran/abdullaah_basfar',
    padded: true,
  },
  'c8775b0c-9828-481d-abf6-670b1b44d3d0': {
    baseUrl: 'https://download.quranicaudio.com/quran/abdullah_matroud',
    padded: true,
  },
  'e56cfedd-b001-4909-a286-c2e37bacd3bd': {
    baseUrl:
      'https://download.quranicaudio.com/qdc/abdurrahmaan_as_sudais/murattal',
    padded: false,
  },
  'b7788b14-2289-410b-84e2-08e96a092406': {
    baseUrl: 'https://download.quranicaudio.com/qdc/abu_bakr_shatri/murattal',
    padded: false,
  },
  'bfafeb7e-1cde-491e-b816-6e530fbf34f8': {
    baseUrl: 'https://audio-cdn.tarteel.ai/quran/surah/alnufais/murattal/mp3',
    padded: true,
  },
  '8d797b9d-35d2-4f8d-9155-068b8faef1cd': {
    baseUrl: 'https://download.quranicaudio.com/quran/ahmad_nauina',
    padded: true,
  },
  'f6a3e2a8-6582-4325-8c1f-e1d4fae1172a': {
    baseUrl: 'https://download.quranicaudio.com/quran/ahmed_ibn_3ali_al-3ajamy',
    padded: true,
  },
  'f4a8546d-ea6c-430e-b78f-bc1d392d2fe4': {
    baseUrl: 'https://download.quranicaudio.com/quran/akram_al_alaqmi',
    padded: true,
  },
  '15cd2ce6-ea16-4673-88e7-cb835d2c6523': {
    baseUrl: 'https://download.quranicaudio.com/quran/ali_hajjaj_alsouasi',
    padded: true,
  },
  '907464eb-bd2f-406d-be4c-bfde74bba3a9': {
    baseUrl: 'https://download.quranicaudio.com/quran/ali_jaber',
    padded: true,
  },
  'ad6b3383-0004-4bba-ab91-b4f584b3be9f': {
    baseUrl: 'https://download.quranicaudio.com/quran/bandar_baleela/complete',
    padded: true,
  },
  '01484bac-8324-48a8-83f9-393de7435b6d': {
    baseUrl: 'https://download.quranicaudio.com/quran/fares',
    padded: true,
  },
  'b1a96977-8f46-4c26-b3f0-37b63d447c8b': {
    baseUrl: 'https://download.quranicaudio.com/qdc/hani_ar_rifai/murattal',
    padded: false,
  },
  'c5072c2e-8648-479c-a6f6-fce8843403b8': {
    baseUrl: 'https://download.quranicaudio.com/qdc/khalid_jalil/murattal/mp3',
    padded: false,
  },
  'c958e681-628e-474c-b8bc-c003214fbca6': {
    baseUrl: 'https://download.quranicaudio.com/qdc/khalifah_taniji/murattal',
    padded: false,
  },
  '6f5b0661-0e21-418a-ab60-2f8b2cdc9b5f': {
    baseUrl: 'https://server13.mp3quran.net/husr',
    padded: true,
  },
  '243312ab-9884-4af2-a034-64774b0f2276': {
    baseUrl: 'https://server12.mp3quran.net/maher',
    padded: true,
  },
  'd375b45c-0c0f-48e1-a940-526bc1f68890': {
    baseUrl: 'https://download.quranicaudio.com/quran/mahmood_ali_albana',
    padded: true,
  },
  '5af2e1f8-8da2-47b1-adb4-ac0f2e33c246': {
    baseUrl: 'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal',
    padded: false,
  },
  '3c40d75e-0f82-413c-a188-3dc1e9df10fd': {
    baseUrl: 'https://download.quranicaudio.com/quran/mohammad_altablawi',
    padded: true,
  },
  'db736d03-e7c3-4692-ac7c-588f09ed5ad0': {
    baseUrl: 'https://download.quranicaudio.com/quran/mostafa_ismaeel',
    padded: true,
  },
  '78a256f3-b1b8-4e1f-b593-d73a6b8dc64d': {
    baseUrl:
      'https://download.quranicaudio.com/quran/muhammad_jibreel/complete',
    padded: true,
  },
  'bb727f2a-f02b-4b7a-a082-a36eb9b7ee07': {
    baseUrl: 'https://download.quranicaudio.com/quran/nasser_bin_ali_alqatami',
    padded: true,
  },
  'ecf8c64a-20ec-4189-bc19-3c653b95a4a3': {
    baseUrl:
      'https://download.quranicaudio.com/quran/sa3d_al-ghaamidi/complete',
    padded: true,
  },
  'c914fd19-7c03-46bc-927b-eca3f19400c8': {
    baseUrl: 'https://download.quranicaudio.com/quran/sahl_yaaseen',
    padded: true,
  },
  '21d44883-7559-425f-be90-b7ef23bbff57': {
    baseUrl: 'https://download.quranicaudio.com/quran/salaah_bukhaatir',
    padded: true,
  },
  '12a085ac-5d59-4e23-a4a7-ee4ca974bd65': {
    baseUrl: 'https://download.quranicaudio.com/quran/salahbudair',
    padded: true,
  },
  '98a78b63-8921-4367-bd09-73cff4802d90': {
    baseUrl: 'https://download.quranicaudio.com/qdc/saud_ash-shuraym/murattal',
    padded: true,
  },
  'efeccedb-81c6-4ba5-b49a-f69fc723c46b': {
    baseUrl: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad',
    padded: true,
  },
  '03c3971a-a438-4f11-8795-53ac35eba8d6': {
    baseUrl: 'https://server10.mp3quran.net/minsh',
    padded: true,
  },
  'a6f8542d-c32d-4db5-9a51-2abeb4c15393': {
    baseUrl: 'https://download.quranicaudio.com/qdc/yasser_ad-dussary/mp3',
    padded: false,
  },
};

/**
 * Resolve the audio URL for a given rewayat and surah number.
 * Checks TIMESTAMP_AUDIO_OVERRIDES first, then falls back to the rewayat's server URL.
 */
export function resolveMushafAudioUrl(
  rewayatId: string,
  surahNumber: number,
): string {
  const paddedSurah = surahNumber.toString().padStart(3, '0');

  // Check timestamp audio overrides first
  const override = TIMESTAMP_AUDIO_OVERRIDES[rewayatId];
  if (override) {
    const filename = override.padded
      ? `${paddedSurah}.mp3`
      : `${surahNumber}.mp3`;
    return `${override.baseUrl}/${filename}`;
  }

  // Fall back to rewayat server URL
  const reciter = RECITERS.find(r => r.rewayat.some(rw => rw.id === rewayatId));
  if (reciter) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      return `${rewayat.server}/${paddedSurah}.mp3`;
    }
  }

  // Last resort: construct from rewayat ID (shouldn't happen)
  throw new Error(`Cannot resolve audio URL for rewayat ${rewayatId}`);
}

/**
 * Find the reciter and rewayat info for a given rewayat ID.
 */
export function findReciterForRewayat(rewayatId: string): {
  reciter: Reciter;
  rewayatName: string;
  style: string;
} | null {
  for (const reciter of RECITERS) {
    const rewayat = reciter.rewayat.find(rw => rw.id === rewayatId);
    if (rewayat) {
      return {
        reciter,
        rewayatName: rewayat.name,
        style: rewayat.style,
      };
    }
  }
  return null;
}
