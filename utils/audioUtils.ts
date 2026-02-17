import {Reciter} from '@/data/reciterData';
import {useDownloadStore} from '@/services/player/store/downloadStore';
import {resolveFilePath} from '@/services/downloadService';

// TEMPORARY: Use quranicaudio.com URLs so ayah timestamps align with audio.
// The timestamp data was generated from quranicaudio recordings, not mp3quran.
// Remove this map once we re-generate timestamps against mp3quran audio or
// permanently switch audio sources.
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
    baseUrl: 'https://download.quranicaudio.com/qdc/khalil_al_husary/murattal',
    padded: false,
  },
  '243312ab-9884-4af2-a034-64774b0f2276': {
    baseUrl:
      'https://download.quranicaudio.com/quran/maher_almu3aiqly/year1440',
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
    baseUrl:
      'https://download.quranicaudio.com/qdc/siddiq_al-minshawi/mujawwad',
    padded: true,
  },
  '03c3971a-a438-4f11-8795-53ac35eba8d6': {
    baseUrl: 'https://download.quranicaudio.com/qdc/siddiq_minshawi/murattal',
    padded: false,
  },
  'a6f8542d-c32d-4db5-9a51-2abeb4c15393': {
    baseUrl: 'https://download.quranicaudio.com/qdc/yasser_ad-dussary/mp3',
    padded: false,
  },
};

export function generateAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  const paddedSurahId = surahId.padStart(3, '0');

  // Get the rewayat - either specified or default to first one
  const rewayat = rewayatId
    ? reciter.rewayat.find(r => r.id === rewayatId)
    : reciter.rewayat[0];

  if (!rewayat) {
    throw new Error('No rewayat found for reciter');
  }

  // TEMPORARY: Override to quranicaudio URLs for timestamp-aligned audio
  const override = TIMESTAMP_AUDIO_OVERRIDES[rewayat.id];
  if (override) {
    const filename = override.padded
      ? `${paddedSurahId}.mp3`
      : `${parseInt(surahId, 10)}.mp3`;
    return `${override.baseUrl}/${filename}`;
  }

  // If the server URL is a Supabase storage URL
  if (rewayat.server.includes('supabase.co')) {
    return `${rewayat.server}/${paddedSurahId}.mp3`;
  }

  // Default mp3quran.net URL
  return `${rewayat.server}/${paddedSurahId}.mp3`;
}

/**
 * Generates an audio URL that prefers local downloaded files over remote URLs
 * @param reciter - Reciter object
 * @param surahId - Surah ID as string
 * @param rewayatId - Optional specific rewayat ID
 * @returns Local file path if downloaded, otherwise remote URL
 */
export function generateSmartAudioUrl(
  reciter: Reciter,
  surahId: string,
  rewayatId?: string,
): string {
  const downloadStore = useDownloadStore.getState();

  // Check if downloaded with specific rewayat
  if (rewayatId) {
    const download = downloadStore.getDownloadWithRewayat(
      reciter.id,
      surahId,
      rewayatId,
    );
    if (download) {
      // Resolve the relative path to absolute path at runtime
      // This ensures paths remain valid after iOS app updates
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId} (Rewayat: ${rewayatId}): ${absolutePath}`,
      );
      return absolutePath;
    }
  } else {
    // Check without rewayat (legacy downloads without rewayatId)
    const download = downloadStore.getDownload(reciter.id, surahId);
    if (download && download.status === 'completed') {
      const absolutePath = resolveFilePath(download.filePath);
      console.log(
        `Using local file for ${reciter.name} - Surah ${surahId}: ${absolutePath}`,
      );
      return absolutePath;
    }
  }

  // Fall back to remote URL if not downloaded
  console.log(
    `Using remote URL for ${reciter.name} - Surah ${surahId}${
      rewayatId ? ` (Rewayat: ${rewayatId})` : ''
    }`,
  );
  return generateAudioUrl(reciter, surahId, rewayatId);
}
