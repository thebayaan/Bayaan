import type {Rewayat} from '@/data/reciterData';

// The CDN serves recitation files as `immutable` for a year, so a replaced file
// needs a new URL to get past HTTP caches. Bump a rewayat's entry whenever its
// files are replaced in place: a number versions every surah of the rewayat, a
// map versions only the surahs it lists.
const AUDIO_FILE_VERSIONS: Record<string, number | Record<number, number>> = {
  // Hasan Saleh, Hafs murattal: 20 surahs had an inverted right channel (silent
  // in mono) and were re-encoded on 2026-10-28/29.
  '65962996-0864-4ef9-9001-932fdc87c8f8': 2,
  // Hafs Al-Fatiha recordings that open without the basmala: a basmala was
  // added at the start on 2026-10-29.
  'f877d4f8-0834-4401-a169-f1435a7dff09': {1: 2}, // abdulaziz-alasiri
  '5b2ffba0-d38c-4e96-9b95-4b5edb58477a': {1: 2, 26: 2}, // abdullah-qarafi
  '5af3ea9b-bfb5-4018-9365-c6daf7827c65': {1: 2}, // abdulmajeed-al-arkani
  'e8c4e00b-b84b-4f1f-982f-09fc155b0d3c': {1: 2}, // abdulmohsin-al-askar
  '319a2586-d93e-4494-9f27-6b3e9f6b654b': {1: 2}, // abdulmohsin-al-obaikan
  '15424ace-0623-4ebb-b08b-ff502e974e52': {1: 2}, // abdulrahman-aljuraydhi
  '0e7944ac-de91-4bc2-a6a1-4976140e7eb7': {1: 2}, // abdulwali-al-arkani
  'bfafeb7e-1cde-491e-b816-6e530fbf34f8': {1: 2, 2: 2}, // ahmad-al-nufais
  '81b8f244-577d-457e-b175-2a79afc0f03b': {1: 2, 16: 2, 45: 2, 50: 2}, // ahmad-talib-bin-humaid (016 trimmed)
  'a762d292-6fd1-4120-a55a-4c18d289f6e4': {1: 2}, // khaled-al-qahtani
  'd7f42caf-d6ee-4f21-a7c9-4b5c25ccd34a': {1: 2}, // khalid-al-shoraimy
  'acf9420e-a268-4951-abfc-050df35e0f11': {1: 2, 10: 2, 11: 2}, // malik-ahmad (010/011 were swapped)
  '887424f7-9146-46db-b144-a8b40a6949cf': {1: 2, 3: 2}, // youssef-edghouch
  '697eddea-178e-4c4b-b3e9-04d381c92d59': {1: 2}, // yusuf-al-aidroos
  // Recordings trimmed of trailing noise after the last ayah, or given a basmala
  // in place of an unrecognised Al-Fatiha intro (2026-10-29).
  '8335b8d3-2589-489e-a472-67f27c7fe128': {2: 2, 5: 2, 6: 2, 9: 2}, // abdulghani-abdullah
  '5f7348eb-e244-49dd-bf76-d4c03ff9b4f4': {36: 2}, // abdullah-fahmi
  'e432c4f8-eaab-4572-8971-95e4f40b3326': {9: 2, 11: 2}, // mohammed-hafas-ali
  '367a93cd-da44-4b2d-b462-9f070c5c5402': {17: 2}, // saidin-abdulrahman
  '61e0357f-9ce6-4922-a3b2-e78c6d9b5771': {2: 2, 6: 2}, // fahad-al-kandari
  '5046099d-1642-4141-85ca-d96750956742': {27: 2, 73: 2}, // fawaz-alkabi
  'e260feb9-fe2d-46ea-99f3-8deeb87eba50': {2: 2, 56: 2}, // hussain-alshaik
  '824d6212-06c3-4e9f-9a74-fd977b69b3de': {1: 2, 26: 2}, // alwaleed-al-shamsan
  'b958d3cf-47b3-4e47-863c-87c81c355e73': {1: 2}, // hamad-al-daghriri
  '6757f5cc-4c08-4268-8906-ed89757e8247': {1: 2}, // othman-al-ansary
  '8c892091-6307-4489-828d-7f255d1d0028': {1: 2}, // umar-muhammad-al-qasim
  // Truncated recordings whose MP3 length header claimed far more audio than
  // they hold; headers rebuilt losslessly (2026-10-29).
  '1df87e0d-bb9e-447d-be78-8e8c4dbfeb34': {
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    7: 2,
    8: 2,
    9: 2,
    11: 2,
    13: 2,
  }, // khalid-algamdi
  '3009ea23-319a-44c2-b1b6-d69c71aa7ff4': {41: 2}, // mohammad-al-airawy (warsh-azraq)
  'b9fd0aef-7cbd-4ed6-af1e-d74264a1f1ad': {48: 2, 50: 2}, // salman-alotaibi
  // Mislabeled files renamed to the surah they hold (2026-10-30).
  'accf6db5-b752-4790-8010-60d459c4568d': {106: 2, 107: 2, 108: 2}, // marwan-alakri (qalon)
  'cdd6d877-da42-4d6a-b930-8827ae488be3': {
    12: 2,
    18: 2,
    19: 2,
    31: 2,
    36: 2,
    55: 2,
    56: 2,
    67: 2,
  }, // nabil-al-rifay
  // Re-sourced 2026-11-02: the old files held another surah / skipped an ayah.
  '5879a2a0-8a8c-40e9-b6d0-b57ac6130025': {114: 2}, // rami-aldeais
  '0260ba5c-c685-48b2-b65b-18566e1c4bf7': {6: 2}, // saleh-alshamrani
  // Misnumbered files renamed to the surah they hold (2026-11-02).
  '4b4c0de9-da86-4ba1-a674-c51e17db05ff': {
    28: 2,
    30: 2,
    31: 2,
    32: 2,
    33: 2,
    34: 2,
    35: 2,
    36: 2,
    37: 2,
    38: 2,
    39: 2,
    40: 2,
    41: 2,
    43: 2,
    45: 2,
    47: 2,
    48: 2,
    49: 2,
    50: 2,
    52: 2,
    53: 2,
    54: 2,
    55: 2,
    56: 2,
    57: 2,
    58: 2,
    60: 2,
    61: 2,
    63: 2,
    64: 2,
    65: 2,
    66: 2,
    67: 2,
    68: 2,
    69: 2,
    70: 2,
    71: 2,
    72: 2,
    73: 2,
    74: 2,
    75: 2,
    76: 2,
    77: 2,
    78: 2,
    79: 2,
    80: 2,
    81: 2,
    82: 2,
    83: 2,
    84: 2,
    85: 2,
    87: 2,
    88: 2,
    89: 2,
    90: 2,
    91: 2,
    92: 2,
    93: 2,
    94: 2,
    95: 2,
    96: 2,
    97: 2,
    98: 2,
    99: 2,
    100: 2,
    101: 2,
    102: 2,
    103: 2,
    104: 2,
    105: 2,
    106: 2,
    107: 2,
    108: 2,
    109: 2,
    110: 2,
    111: 2,
    112: 2,
    113: 2,
    114: 2,
  }, // yasser-mamdouh (027-111 shifted +1/+2/+3)
  'f25a53df-2d91-4cf3-96a5-03179a5601bc': {11: 2, 12: 2, 14: 2}, // rachid-belaachya
  '91b3ad0c-2a19-40a0-80eb-525e37b05c4e': {97: 2, 98: 2}, // muhammad-zarami (097/098 swapped)
  // Leading Al-Fatiha / previous surah's end / talk trimmed from the audio, timings shifted (2026-11-02).
  '087ec556-62b2-459b-ba78-772ccbd2a2b7': {75: 2}, // abdelaziz-sheim (warsh)
  'a56ed215-6e3d-4a36-b66a-8de197bd1759': {71: 2}, // abdulaziz-alturki
  '457d026c-d446-4e8e-9022-cbdf39c479fd': {
    5: 2,
    7: 2,
    9: 2,
    13: 2,
    19: 2,
    23: 2,
    25: 2,
    27: 2,
    32: 2,
    36: 2,
    40: 2,
    47: 2,
    48: 2,
    49: 2,
    59: 2,
    79: 2,
  }, // abdullahi-abba-zaria (khalaf)
  '7817c401-043c-4341-934d-88ab778b6dcf': {49: 2}, // abdulrahman-mosad
  'f94a83c3-5b0f-4ddf-9cf7-cfb92d052d6e': {89: 2}, // abdulrasheed-soufi (shubah)
  '9d0dd776-d36a-47ec-9ee6-8c3bc6461948': {35: 2, 64: 2, 65: 2}, // ahmad-talib-bin-humaid alt-1
  '30253aae-29d1-405e-9c5d-8c67d9d2d3b6': {2: 2}, // fatih-seferagic
  'b1fba2c8-3d11-4c42-b87d-78970a310264': {32: 2, 41: 2}, // hazza-al-balushi
  '3d53658a-3968-4459-8596-29cf88f86449': {11: 2}, // ibrahem-assadan
  '5cee1ad1-533f-49e0-8b91-b9527144bcf2': {23: 2}, // ibrahim-al-jebreen
  'f815e248-134d-4668-814e-7e230bcdb70e': {2: 2}, // islam-sobhi alt-1
  '0d974769-52bb-4eb2-b9e4-b29f42b2f9c2': {36: 2}, // issa-omar-sanankoua
  'c5072c2e-8648-479c-a6f6-fce8843403b8': {3: 2}, // khalid-al-jileel
  '49ba827c-3779-43de-9ae0-9c12ee137ec6': {20: 2, 54: 2}, // majed-al-enezi
  '1ca454ad-989c-44a5-af2a-d0e30bf47515': {2: 2}, // mohammed-hamed
  'd6269c23-f948-4bab-a4fd-f9fd9284f337': {31: 2}, // muhammad-al-hafiz
  '7d362eda-bb33-4520-a3e2-516b504eb397': {57: 2, 70: 2}, // omar-al-darweez
  'bfaf1998-8b6a-43fa-a3e9-79072189e2ad': {2: 2}, // omar-bin-diaa-aldeen
  '212a0c74-e0fe-4cff-8a1f-3aae8de29d04': {53: 2}, // raad-al-kurdi
  '72fd02c5-e6a0-4a5e-8ea7-98ebc939a62d': {30: 2}, // rasheed-ifrad (warsh)
  'b4f5c67b-b723-42c1-94d7-3098ec3f128c': {6: 2, 7: 2}, // riad-aldzairey
  'a62802cc-5dff-4dcf-85aa-c8182e032f6a': {2: 2, 39: 2}, // sami-al-dosari
  'f0ddadf9-6185-4247-9754-45af67b70985': {2: 2}, // saud-al-shuraim alt-1
};

/** Remote URL of one surah's audio file for a rewayat. */
export function audioFileUrl(
  rewayat: Pick<Rewayat, 'id' | 'server'>,
  surah: number | string,
): string {
  const padded = String(surah).padStart(3, '0');
  const entry = AUDIO_FILE_VERSIONS[rewayat.id];
  const version = typeof entry === 'number' ? entry : entry?.[Number(surah)];
  const url = `${rewayat.server}/${padded}.mp3`;
  return version ? `${url}?v=${version}` : url;
}
