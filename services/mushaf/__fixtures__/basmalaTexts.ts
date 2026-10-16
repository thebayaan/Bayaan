// @ai-generated
/**
 * Expected surah-opening basmala texts (contract C6) for the tests, written as
 * code points so no editor or normalizer can change a mark or its order.
 * Source: the signed KFGQPC printed-mushaf Word files (see
 * data/mushaf/digitalkhatt/<file id>-basmala.json, `source`).
 *
 * Not imported by app code.
 */
import type {RewayahId} from '@/services/rewayah/RewayahIdentity';

const SP = ' ';

// ── Word forms ──────────────────────────────────────────────────────────────
// bism-: ba (with shadda when the Word file merges a preceding ba into it),
// kasra, seen, sukun, meem, kasra. Sukun: KFGQPC U+06E1 (al-Duri, al-Susi,
// Kufi / Makki), U+0652 (Nafi' Maghribi); DigitalKhatt U+0652, and U+06DF
// (small circle) for the Nafi' sukun.
const bism = (sukun: string, shadda = false) =>
  `\u0628${shadda ? '\u0651' : ''}\u0650\u0633${sukun}\u0645\u0650`;
// Maghribi wasl alef: alef, kasra, U+06EC (the start dot).
const WASL = '\u0627\u0650\u06EC';
const allahMaghribi = `${WASL}\u0644\u0644\u0651\u064E\u0647\u0650`;
const rahmanMaghribi = (sukun: string) =>
  `${WASL}\u0644\u0631\u0651\u064E\u062D${sukun}\u0645\u064E\u0670\u0646\u0650`;
const rahimMaghribi = `${WASL}\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650`;
// Madani wasla U+0671.
const allahMadani = '\u0671\u0644\u0644\u0651\u064E\u0647\u0650';
const rahmanMadani = (sukun: string) =>
  `\u0671\u0644\u0631\u0651\u064E\u062D${sukun}\u0645\u064E\u0670\u0646\u0650`;
const rahimMadani =
  '\u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';

const maghribi = (sukun: string, shadda = false) =>
  [
    bism(sukun, shadda),
    allahMaghribi,
    rahmanMaghribi(sukun),
    rahimMaghribi,
  ].join(SP);
const madani = (sukun: string, shadda = false) =>
  [bism(sukun, shadda), allahMadani, rahmanMadani(sukun), rahimMadani].join(SP);

const NAFI_SUKUN_KFGQPC = '\u0652';
const NAFI_SUKUN_DK = '\u06DF';
const SUKUN_KFGQPC = '\u06E1';
const SUKUN_DK = '\u0652';
/** Maghribi (Habti) waqf sign after the basmala of 75, 83, 90, 104. */
const HABTI_WAQF = '\u06D6';

export interface ExpectedBasmala {
  fileId: string;
  /** Verbatim Word-file text at most surah heads (and the Fatiha). */
  official: string;
  /** What the app draws (normalize.dk_tokens of `official`). */
  dk: string;
  /** Surahs the Word file writes differently: verbatim text and drawn text. */
  bySurah: Record<number, {official: string; dk: string}>;
  /** Surahs whose drawn text differs from `dk` (a subset of bySurah). */
  drawnOverrides: number[];
  /** SHA-256 of the signed Word file(s) the text may come from. */
  sourceSha256: string[];
}

const SHADDA_95_97 = [95, 97];
const WAQF_SURAHS = [75, 83, 90, 104];

function entries(
  surahs: number[],
  official: string,
  dk: string,
): Record<number, {official: string; dk: string}> {
  return Object.fromEntries(surahs.map(s => [s, {official, dk}]));
}

const nafi = (fileId: string, sha: string, shadda9597: boolean) => {
  const official = maghribi(NAFI_SUKUN_KFGQPC);
  const dk = maghribi(NAFI_SUKUN_DK);
  return {
    fileId,
    official,
    dk,
    bySurah: {
      // The DigitalKhatt render policy omits the Habti waqf sign (habti-waqf).
      ...entries(WAQF_SURAHS, official + HABTI_WAQF, dk),
      ...(shadda9597
        ? entries(
            SHADDA_95_97,
            maghribi(NAFI_SUKUN_KFGQPC, true),
            maghribi(NAFI_SUKUN_DK, true),
          )
        : {}),
    },
    drawnOverrides: shadda9597 ? SHADDA_95_97 : [],
    sourceSha256: [sha],
  };
};

const abuAmr = (fileId: string, sha: string, shaddaSurahs: number[]) => ({
  fileId,
  official: maghribi(SUKUN_KFGQPC),
  dk: maghribi(SUKUN_DK),
  bySurah: entries(
    shaddaSurahs,
    maghribi(SUKUN_KFGQPC, true),
    maghribi(SUKUN_DK, true),
  ),
  drawnOverrides: shaddaSurahs,
  sourceSha256: [sha],
});

const close = (fileId: string, shas: string[]) => ({
  fileId,
  official: madani(SUKUN_KFGQPC),
  dk: madani(SUKUN_DK),
  bySurah: entries(
    SHADDA_95_97,
    madani(SUKUN_KFGQPC, true),
    madani(SUKUN_DK, true),
  ),
  drawnOverrides: SHADDA_95_97,
  sourceSha256: shas,
});

export const EXPECTED_BASMALA: Readonly<
  Partial<Record<RewayahId, ExpectedBasmala>>
> = {
  warsh: nafi(
    'warsh',
    '7302c27a666857c9a3e77a304026c12ca12955003765eaa2e418df5d8bc688ec',
    false,
  ),
  qalun: nafi(
    'qaloon',
    '418a0f6e6a7887005f7cfd43de3159832563c24213cab71fe56af8d0a4b3d153',
    true,
  ),
  'al-duri-abi-amr': abuAmr(
    'doori',
    '8385661b53a0ff65e790161f146b5d736b7c9d7eb093a16427a30a7b3110916b',
    SHADDA_95_97,
  ),
  // al-Susi's idgham kabir: 13:43 and 14:52 end in a ba merged into the
  // basmala of the next surah.
  'al-susi': abuAmr(
    'soosi',
    '149e30d33a98e50c042b4744e1262521461e06a6ecf87a1be86cc5a3d638d126',
    [14, 15, ...SHADDA_95_97],
  ),
  shubah: close('shouba', [
    '76e6b8a381fc9fc3f4a4cdf8c1c902986d045b9d910e68dc37d60ad8993e0e23',
  ]),
  'al-bazzi': close('bazzi', [
    '63b62374b2c3ff2fc77798e27f0ba98e23163dac7d3cc954757b60b712044080',
  ]),
  // Two signed Qunbul Word files with the same text (fonts site 2022 and
  // developer page package).
  qunbul: close('qumbul', [
    '9c737e7f52cd03998d633f142136d9a09b537c7a9ad8b8ed83336f3ed2d82a23',
    '5254705010c7cf51bde87f83632d03cf07584472291b89b09bffb5447a916d5c',
  ]),
};

/** The 7 rewayat with a basmala file. */
export const BASMALA_REWAYAT = Object.keys(EXPECTED_BASMALA) as RewayahId[];

/** The text a rewayah must draw at the head of `surah` (2..114, not 9). */
export function expectedDrawnBasmala(
  rewayah: RewayahId,
  surah: number,
): string {
  const expected = EXPECTED_BASMALA[rewayah];
  if (!expected) throw new Error(`no expected basmala for ${rewayah}`);
  return expected.drawnOverrides.includes(surah)
    ? expected.bySurah[surah].dk
    : expected.dk;
}
