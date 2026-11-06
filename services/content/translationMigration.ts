import {
  crosswalkTranslationId,
  isQfTranslationId,
} from '@/services/translation/translationRemap';
import type {DownloadedTranslationMeta} from '@/types/translation';
import {keyFor} from './contentKeys';
import {emptyRow, type ContentRegistry} from './contentRegistry';

export interface TranslationMigrationDeps {
  registry: ContentRegistry;
  db: {
    getDownloadedTranslations(): Promise<DownloadedTranslationMeta[]>;
    renameTranslation(from: string, to: string): Promise<void>;
    deleteTranslation(identifier: string): Promise<void>;
  };
  // One notice naming every removed edition.
  notifyRemoved: (names: string[]) => void;
  // Refreshes the picker after the rows changed.
  reload: () => Promise<void>;
  now: number;
}

// Registers a downloaded QF edition as a legacy copy (version 0), so the
// first check replaces it with QF's text and footnotes. A row of any kind
// (user_removed included) wins.
async function adoptAsLegacy(
  registry: ContentRegistry,
  id: string,
  name: string,
): Promise<void> {
  const key = keyFor('translation', id);
  if (await registry.get(key)) return;
  await registry.upsert({
    ...emptyRow(key, 'translation'),
    legacy: true,
    name,
  });
}

/**
 * Spec 4.7: once per install, AlQuranCloud downloads move to QF ids. A
 * matched edition is renamed in place and registered as legacy; an unmatched
 * one is deleted and named in one notice. The selection is remapped by the
 * settings store's persist migration, not here. Safe to rerun after a kill:
 * renamed rows are numeric and only adopted again.
 */
export async function migrateLegacyTranslations(
  deps: TranslationMigrationDeps,
): Promise<boolean> {
  const state = await deps.registry.getState();
  if (state.translationsMigratedAt !== null) return false;

  const downloaded = await deps.db.getDownloadedTranslations();
  const present = new Set(downloaded.map(item => item.identifier));
  const removed: string[] = [];
  for (const item of downloaded) {
    const id = item.identifier;
    if (isQfTranslationId(id)) {
      // Renamed before a kill, or installed by an earlier build.
      await adoptAsLegacy(deps.registry, id, item.englishName);
      continue;
    }
    const target = crosswalkTranslationId(id);
    if (target === null) {
      await deps.db.deleteTranslation(id);
      present.delete(id);
      removed.push(item.englishName);
      continue;
    }
    if (present.has(target)) {
      // Two editions with one QF text (zh.jian, zh.majian), or the QF
      // edition is already installed: the copy is redundant, not removed.
      await deps.db.deleteTranslation(id);
    } else {
      await deps.db.renameTranslation(id, target);
      present.add(target);
      await adoptAsLegacy(deps.registry, target, item.englishName);
    }
    present.delete(id);
  }

  if (removed.length > 0) deps.notifyRemoved(removed);
  await deps.registry.setState({translationsMigratedAt: deps.now});
  await deps.reload();
  return true;
}
