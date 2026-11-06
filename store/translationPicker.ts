// The translations picker model: which editions to show, in what order and
// with what labels. Pure, so the screen only lays the result out.
import type {
  DownloadedTranslationMeta,
  RemoteTranslationEdition,
} from '@/types/translation';
import {BUNDLED_TRANSLATIONS} from '@/types/translation';
import type {OfferedTranslation} from '@/services/content/contentSync';
import {translationLanguageName} from '@/services/content/translationInstaller';
import type {AppLanguage} from '@/i18n/languages';
import {
  compareLanguageGroups,
  getEnglishLanguageDisplayName,
} from '@/i18n/languageNames';

const UNKNOWN_LANGUAGE = 'Other';

// One edition the picker can download, from the manifest or a fork provider.
export interface OfferedEdition {
  id: string;
  name: string;
  author: string | null;
  // English language name, e.g. "Urdu".
  language: string;
  bytes: number | null;
}

// One picker row, labelled for display.
export interface PickerRow {
  id: string;
  // The edition's name.
  title: string;
  // Author, then download size for editions not yet downloaded; null when
  // there is nothing to add to the title.
  subtitle: string | null;
  language: string;
  isBundled: boolean;
  isDownloaded: boolean;
}

export interface PickerLanguageGroup {
  // English language name, as the catalogue gives it.
  language: string;
  // The language named in the UI language.
  title: string;
  rows: PickerRow[];
}

export interface TranslationPicker {
  // Bundled and downloaded editions, the active one excluded, by title.
  installed: PickerRow[];
  // Editions to download by language: the UI language first, then by
  // localized name.
  groups: PickerLanguageGroup[];
  // No catalog is known yet (first launch offline): say how to get one.
  needsCatalog: boolean;
}

// An edition before it is labelled.
interface Candidate extends OfferedEdition {
  isBundled: boolean;
  isDownloaded: boolean;
}

function languageOf(language: string | undefined): string {
  return translationLanguageName(language) ?? UNKNOWN_LANGUAGE;
}

// The cached manifest's active translations as picker editions.
export function offeredFromManifest(
  entries: readonly OfferedTranslation[],
): OfferedEdition[] {
  return entries.map(entry => ({
    id: entry.id,
    name: entry.meta?.name ?? `Translation ${entry.id}`,
    author: entry.meta?.author ?? null,
    language: languageOf(entry.meta?.language),
    bytes: entry.bytes ?? null,
  }));
}

// A fork provider's editions (RFC-009) as picker editions.
export function offeredFromProvider(
  editions: readonly RemoteTranslationEdition[],
): OfferedEdition[] {
  return editions.map(edition => ({
    id: edition.identifier,
    name: edition.englishName,
    author: edition.name !== edition.englishName ? edition.name : null,
    language: languageOf(edition.language),
    bytes: null,
  }));
}

// Search over name, author and language; an empty query matches everything.
export function matchesTranslationQuery(
  edition: Pick<OfferedEdition, 'name' | 'author' | 'language'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [edition.name, edition.author ?? '', edition.language].some(field =>
    field.toLowerCase().includes(needle),
  );
}

function candidates(
  downloaded: readonly DownloadedTranslationMeta[],
  offered: readonly OfferedEdition[] | null,
): Candidate[] {
  const offeredById = new Map((offered ?? []).map(item => [item.id, item]));
  const rows: Candidate[] = [];
  for (const info of Object.values(BUNDLED_TRANSLATIONS)) {
    rows.push({
      id: info.id,
      name: info.name,
      author: info.author,
      language: info.language,
      bytes: null,
      isBundled: true,
      isDownloaded: true,
    });
  }
  const downloadedIds = new Set<string>();
  for (const meta of downloaded) {
    if (Object.hasOwn(BUNDLED_TRANSLATIONS, meta.identifier)) continue;
    downloadedIds.add(meta.identifier);
    const listed = offeredById.get(meta.identifier);
    rows.push({
      id: meta.identifier,
      name: listed?.name ?? meta.englishName,
      author: listed?.author ?? null,
      language: listed?.language ?? languageOf(meta.language),
      bytes: listed?.bytes ?? null,
      isBundled: false,
      isDownloaded: true,
    });
  }
  for (const item of offered ?? []) {
    if (downloadedIds.has(item.id)) continue;
    if (Object.hasOwn(BUNDLED_TRANSLATIONS, item.id)) continue;
    rows.push({...item, isBundled: false, isDownloaded: false});
  }
  return rows;
}

function toRow(
  edition: Candidate,
  formatSize: (bytes: number) => string,
): PickerRow {
  const size =
    edition.isDownloaded || edition.bytes === null
      ? null
      : formatSize(edition.bytes);
  const subtitle = [edition.author, size].filter(Boolean).join(' · ');
  return {
    id: edition.id,
    title: edition.name,
    subtitle: subtitle && subtitle !== edition.name ? subtitle : null,
    language: edition.language,
    isBundled: edition.isBundled,
    isDownloaded: edition.isDownloaded,
  };
}

function byTitle(a: PickerRow, b: PickerRow): number {
  return a.title.localeCompare(b.title);
}

export function buildTranslationPicker(input: {
  downloaded: readonly DownloadedTranslationMeta[];
  offered: readonly OfferedEdition[] | null;
  selectedId: string;
  query: string;
  // The UI language, which names and orders the language groups.
  uiLanguage: AppLanguage;
  formatSize: (bytes: number) => string;
}): TranslationPicker {
  const {downloaded, offered, selectedId, query, uiLanguage, formatSize} =
    input;
  const visible = candidates(downloaded, offered).filter(edition =>
    matchesTranslationQuery(edition, query),
  );
  const installed = visible
    .filter(edition => edition.isDownloaded && edition.id !== selectedId)
    .map(edition => toRow(edition, formatSize))
    .sort(byTitle);
  const byLanguage = new Map<string, PickerRow[]>();
  for (const edition of visible) {
    if (edition.isDownloaded) continue;
    const group = byLanguage.get(edition.language) ?? [];
    group.push(toRow(edition, formatSize));
    byLanguage.set(edition.language, group);
  }
  const groups = [...byLanguage.entries()]
    .sort(([a], [b]) => compareLanguageGroups(a, b, uiLanguage))
    .map(([language, rows]) => ({
      language,
      title: getEnglishLanguageDisplayName(language, uiLanguage),
      rows: rows.sort(byTitle),
    }));
  return {installed, groups, needsCatalog: offered === null};
}
