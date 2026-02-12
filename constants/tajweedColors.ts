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
};
