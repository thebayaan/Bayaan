// @ts-check
/**
 * Surah al-Fatihah in two orthographies.
 *
 * qpc: Bayaan's own text (data/quran.json, KFGQPC Hafs Uthmani, Madani
 *      orthography). The tests check it is byte-identical to the repo data.
 * msi: the Mushaf Standar Indonesia spelling that LPMQ's worked example
 *      (Pedoman, section II.F, pp. 40 to 41 of the book) is signed from,
 *      transcribed from that example. Written with the sukun U+06E1, the
 *      vertical fathah U+0670 and the MSI waqf signs (U+06D9 lā, U+06D7
 *      qalā; U+06F5 stands for the MSI sign after the first عليهم that marks
 *      an ayah boundary of another counting). The ruku sign (ع) after ayah 7
 *      is a margin mark and is left out.
 *      ASCII key for the comments: A alif, b ba, t ta, H ḥa, d dal, Z dhal,
 *      r ra, s sin, S ṣad, D ḍad, T ṭa, E ain, g ghain, q qaf, k kaf, l lam,
 *      m mim, n nun, h ha, w waw, y ya; a fathah, i kasrah, u dammah,
 *      o sukun, ~ shadda, ^ vertical fathah, M madd sign; 1 waqf lā, 2 waqf
 *      qalā, 5 the ۵ sign.
 * transliteration: data/transliteration.json, markup removed.
 */

export const FATIHAH = [
  {
    number: 1,
    qpc: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\u00a0١',
    msi: 'بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ ١',
    // MSI spelled in ASCII (see header): bisomi All~^hi Alr~aHom^ni Alr~aHiyomi
    transliteration: 'Bismi Allahi alrrahmani alrraheemi',
  },
  {
    number: 2,
    qpc: 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ\u00a0٢',
    msi: 'اَلۡحَمۡدُ لِلّٰهِ رَبِّ الۡعٰلَمِيۡنَ ۙ ٢',
    // MSI spelled in ASCII (see header): AaloHamodu lil~^hi rab~i AloE^lamiyona 1
    transliteration: 'Alhamdu lillahi rabbi alalameena',
  },
  {
    number: 3,
    qpc: 'ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\u00a0٣',
    msi: 'الرَّحۡمٰنِ الرَّحِيۡمِ ۙ ٣',
    // MSI spelled in ASCII (see header): Alr~aHom^ni Alr~aHiyomi 1
    transliteration: 'Alrrahmani alrraheemi',
  },
  {
    number: 4,
    qpc: 'مَٰلِكِ يَوۡمِ ٱلدِّينِ\u00a0٤',
    msi: 'مٰلِكِ يَوۡمِ الدِّيۡنِ ۗ ٤',
    // MSI spelled in ASCII (see header): m^liki yawomi Ald~iyoni 2
    transliteration: 'Maliki yawmi alddeeni',
  },
  {
    number: 5,
    qpc: 'إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ\u00a0٥',
    msi: 'اِيَّاكَ نَعۡبُدُ وَاِيَّاكَ نَسۡتَعِيۡنُ ۗ ٥',
    // MSI spelled in ASCII (see header): Aiy~aAka naEobudu waAiy~aAka nasotaEiyonu 2
    transliteration: 'Iyyaka naAAbudu waiyyaka nastaAAeenu',
  },
  {
    number: 6,
    qpc: 'ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ\u00a0٦',
    msi: 'اِهۡدِنَا الصِّرَاطَ الۡمُسۡتَقِيۡمَ ۙ ٦',
    // MSI spelled in ASCII (see header): AihodinaA AlS~iraATa Alomusotaqiyoma 1
    transliteration: 'Ihdina alssirata almustaqeema',
  },
  {
    number: 7,
    qpc: 'صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ\u00a0٧',
    msi: 'صِرَاطَ الَّذِيۡنَ اَنۡعَمۡتَ عَلَيۡهِمۡ ۙ ۵ غَيۡرِ الۡمَغۡضُوۡبِ عَلَيۡهِمۡ وَلَا الضَّآلِّيۡنَ ٧',
    // MSI spelled in ASCII (see header): SiraATa Al~aZiyona AanoEamota Ealayohimo 1 5 gayori AlomagoDuwobi Ealayohimo walaA AlD~aAMl~iyona
    transliteration:
      'Sirata allatheena anAAamta AAalayhim ghayri almaghdoobi AAalayhim wala alddalleena',
  },
];
