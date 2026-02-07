// Rewayah and style options for recitations (used in uploads organize sheet and elsewhere)

export const DEFAULT_REWAYAH = "Hafs A'n Assem";
export const DEFAULT_STYLE = 'murattal';

export const REWAYAH_OPTIONS = [
  "Hafs A'n Assem",
  "Warsh A'n Nafi'",
  "Qalon A'n Nafi'",
  "Shu'bah A'n Assem",
  "AlDorai A'n Al-Kisa'ai",
  "Albizi A'n Ibn Katheer",
  "Albizi and Qunbol A'n Ibn Katheer",
  "Aldori A'n Abi Amr",
  "Assosi A'n Abi Amr",
  "Hesham A'n Ibn Amer",
  "Ibn Jammaz A'n Abi Ja'far",
  "Ibn Thakwan A'n Ibn Amer",
  "Khalaf A'n Hamzah",
  "Qalon A'n Nafi' Men Tariq Abi Nasheet",
  "Qunbol A'n Ibn Katheer",
  "Rowis and Rawh A'n Yakoob Al Hadrami",
  "Warsh A'n Nafi' Men Tariq Abi Baker Alasbahani",
  "Warsh A'n Nafi' Men Tariq Alazraq",
] as const;

export const STYLE_OPTIONS = [
  {id: 'murattal', label: 'Murattal'},
  {id: 'mojawwad', label: 'Mojawwad'},
  {id: 'molim', label: 'Molim'},
  {id: 'hadr', label: 'Hadr'},
] as const;
