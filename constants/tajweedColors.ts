/** Tajweed rule name → color mapping, shared across all renderers */
export const tajweedColors: {[key: string]: string} = {
  // Red - Necessary Prolongation (Madd: 6)
  madda_necessary: '#BF0100',
  // Pink - Obligatory Prolongation (Madd: 4 or 5)
  madda_obligatory_mottasel: '#FF3EAE',
  madda_obligatory_monfasel: '#FF3EAE',
  // Orange - Permissible Prolongation (Madd: 2, 4, or 6)
  madda_permissible: '#F47215',
  // Gold/Yellow - Normal Prolongation (Madd: 2)
  madda_normal: '#C38A07',
  'custom-alef-maksora': '#C38A07',
  // Green - Nasalization (Ghunnah)
  ghunnah: '#0CBF71',
  idgham_ghunnah: '#0CBF71',
  idgham_shafawi: '#0CBF71',
  ikhafa: '#0CBF71',
  ikhafa_shafawi: '#0CBF71',
  iqlab: '#0CBF71',
  // Light Blue - Qalqala (Echoing Sound)
  qalaqah: '#57CFFF',
  // Dark Blue - Tafkhim (Emphatic Pronunciation of Heavy Letters)
  tafkhim: '#0088C7',
  idgham_mutajanisayn: '#0088C7',
  idgham_mutaqaribayn: '#0088C7',
  idgham_wo_ghunnah: '#0088C7',
  // Gray - Silent (Unannounced Pronunciation)
  slnt: '#AAAAAA',
  ham_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
  // Purple - Silah (Bazzi/Qumbul pronoun lengthening). Colors the small
  // high waw/yeh AND the preceding damma/kasra that it connects to.
  silah: '#8A4FFF',
  // Teal - Minor rewayah diff. Trailing-vowel / mood-shift changes that
  // aren't letter-level variants but deserve a subtle visual marker,
  // distinct from the background orange for MAJOR content changes.
  minor: '#00A0A0',
  // Warsh/Qalun published-mushaf tajweed categories. Colors approximate the
  // standard color-coded Dar al-Ma'rifah / King Fahd Warsh editions so
  // students reading in the app see the same pedagogical signals.
  //   Green — Madd al-Badal / Madd al-Lin (U+06E4 marker).
  madd: '#0CBF71',
  //   Light blue — Hamza tashil / musahhala (U+06EA/U+06EC).
  tashil: '#29B6F6',
  //   Light blue — Ibdal (Warsh hamza → long vowel). Shares hue with
  //   tashil since both are hamza-treatment rules.
  ibdal: '#29B6F6',
  //   Dark blue — Taghliz al-Lam (heavy lam in Allah after ط/ظ/ص).
  taghliz: '#1A46D0',
};

// Background tint applied to whole-word content variants (legacy 'major'
// category for Shouba/Bazzi/Qumbul, and 'mukhtalif' for Warsh/Qaloon/
// Doori/Soosi). Whole-word diffs use a background block instead of a text
// color to keep the foreground channel reserved for letter-level rules
// (madd/tashil/ibdal/taghliz/silah) — matches the published-mushaf
// convention.
export const REWAYAH_DIFF_BACKGROUND = 'rgba(255, 107, 53, 0.3)';
