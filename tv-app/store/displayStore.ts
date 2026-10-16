import {create} from 'zustand';
import {readJSON, writeJSON} from '../services/storage';

/** What the listening room shows over the color field. */
export type OnScreenMode = 'both' | 'arabic' | 'translation' | 'calligraphy';
export type TextSize = 'medium' | 'large' | 'xlarge';

export type TranslationEdition = {
  /** alquran.cloud edition identifier. */
  id: string;
  name: string;
  language: string;
};

/**
 * Translations offered on TV. All are alquran.cloud editions from the phone
 * app's own list (data/availableTranslations.ts), so they are known to
 * resolve; Saheeh International first as the default.
 */
export const TRANSLATIONS: readonly TranslationEdition[] = [
  {id: 'en.sahih', name: 'Saheeh International', language: 'English'},
  {id: 'en.hilali', name: 'Hilali & Muhsin Khan', language: 'English'},
  {id: 'en.pickthall', name: 'Pickthall', language: 'English'},
  {id: 'en.yusufali', name: 'Yusuf Ali', language: 'English'},
  {id: 'fr.hamidullah', name: 'Muhammad Hamidullah', language: 'Français'},
  {id: 'tr.diyanet', name: 'Diyanet İşleri', language: 'Türkçe'},
  {id: 'ur.jalandhry', name: 'Fateh Muhammad Jalandhry', language: 'اردو'},
  {id: 'id.indonesian', name: 'Kementerian Agama', language: 'Indonesia'},
  {id: 'ms.basmeih', name: 'Abdullah Basmeih', language: 'Melayu'},
  {id: 'es.cortes', name: 'Julio Cortés', language: 'Español'},
  {id: 'de.aburida', name: 'Abu Rida', language: 'Deutsch'},
  {id: 'bn.bengali', name: 'Muhiuddin Khan', language: 'বাংলা'},
  {id: 'ru.kuliev', name: 'Elmir Kuliev', language: 'Русский'},
];

export const DEFAULT_EDITION = TRANSLATIONS[0].id;

export const ON_SCREEN_MODES: readonly {value: OnScreenMode; label: string}[] =
  [
    {value: 'both', label: 'Arabic + translation'},
    {value: 'arabic', label: 'Arabic'},
    {value: 'translation', label: 'Translation'},
    {value: 'calligraphy', label: 'Calligraphy only'},
  ];

export const TEXT_SIZES: readonly {
  value: TextSize;
  label: string;
  scale: number;
}[] = [
  {value: 'medium', label: 'Medium', scale: 0.85},
  {value: 'large', label: 'Large', scale: 1},
  {value: 'xlarge', label: 'Extra large', scale: 1.2},
];

export function findTranslation(id: string): TranslationEdition {
  return TRANSLATIONS.find(t => t.id === id) ?? TRANSLATIONS[0];
}

export function textScale(size: TextSize): number {
  return TEXT_SIZES.find(s => s.value === size)?.scale ?? 1;
}

/** Short value for the tray, such as "Arabic + English". */
export function onScreenLabel(mode: OnScreenMode, edition: string): string {
  const language = findTranslation(edition).language;
  switch (mode) {
    case 'both':
      return `Arabic + ${language}`;
    case 'arabic':
      return 'Arabic';
    case 'translation':
      return language;
    case 'calligraphy':
      return 'Calligraphy';
  }
}

type Prefs = {mode: OnScreenMode; edition: string; textSize: TextSize};

const KEY = 'bayaan_tv_display';
const DEFAULTS: Prefs = {
  mode: 'both',
  edition: DEFAULT_EDITION,
  textSize: 'large',
};

function load(): Prefs {
  const saved = readJSON<Partial<Prefs>>(KEY) ?? {};
  return {
    mode: ON_SCREEN_MODES.some(m => m.value === saved.mode)
      ? (saved.mode as OnScreenMode)
      : DEFAULTS.mode,
    edition: TRANSLATIONS.some(t => t.id === saved.edition)
      ? (saved.edition as string)
      : DEFAULTS.edition,
    textSize: TEXT_SIZES.some(s => s.value === saved.textSize)
      ? (saved.textSize as TextSize)
      : DEFAULTS.textSize,
  };
}

type DisplayState = Prefs & {
  setMode: (mode: OnScreenMode) => void;
  setEdition: (edition: string) => void;
  setTextSize: (size: TextSize) => void;
};

/** The listening room's on-screen choices, kept across launches. */
export const useDisplayStore = create<DisplayState>((set, get) => {
  const save = (patch: Partial<Prefs>) => {
    const {mode, edition, textSize} = {...get(), ...patch};
    writeJSON<Prefs>(KEY, {mode, edition, textSize});
    set(patch);
  };
  return {
    ...load(),
    setMode: mode => save({mode}),
    setEdition: edition => save({edition}),
    setTextSize: textSize => save({textSize}),
  };
});
