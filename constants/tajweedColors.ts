/** Tajweed rule name → color mapping, shared across all renderers */
export const tajweedColors: {[key: string]: string} = {
  // Red - Necessary Prolongation (Madd: 6)
  madda_necessary: '#DD0000',
  // Pink - Obligatory Prolongation (Madd: 4 or 5)
  madda_obligatory_mottasel: '#FF00FF',
  madda_obligatory_monfasel: '#FF00FF',
  // Orange - Permissible Prolongation (Madd: 2, 4, or 6)
  madda_permissible: '#FF7F00',
  // Gold/Yellow - Normal Prolongation (Madd: 2)
  madda_normal: '#DDAA00',
  'custom-alef-maksora': '#DDAA00',
  // Green - Nasalization (Ghunnah)
  ghunnah: '#00CC00',
  idgham_ghunnah: '#00CC00',
  idgham_shafawi: '#00CC00',
  ikhafa: '#00CC00',
  ikhafa_shafawi: '#00CC00',
  iqlab: '#00CC00',
  // Light Blue - Qalqala (Echoing Sound)
  qalaqah: '#66CCFF',
  // Dark Blue - Tafkhim (Emphatic Pronunciation)
  idgham_mutajanisayn: '#0066FF',
  idgham_mutaqaribayn: '#0066FF',
  idgham_wo_ghunnah: '#0066FF',
  // Gray - Silent (Unannounced Pronunciation)
  slnt: '#AAAAAA',
  ham_wasl: '#AAAAAA',
  laam_shamsiyah: '#AAAAAA',
};
