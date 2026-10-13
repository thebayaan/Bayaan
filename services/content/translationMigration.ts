import {
  crosswalkTranslationId,
  remapLegacyTranslationId,
  RETIRED_SAHEEH_ID,
} from '@/services/translation/translationRemap';
import type {DownloadedTranslationMeta} from '@/types/translation';
import {installResource, retryIsDue, type EngineDeps} from './contentEngine';
import {emptyRow, type ContentRegistry} from './contentRegistry';
import {reportInstall} from './installActivity';

export const TRANSLATION_KEY_PREFIX = 'qf:translations:';
// Where the retired bundled Saheeh International lives on QF.
export const SAHEEH_KEY = `${TRANSLATION_KEY_PREFIX}20`;

const QF_TRANSLATION_ID = /^\d+$/;

export interface TranslationMigrationDeps {
  registry: ContentRegistry;
  db: {
    getDownloadedTranslations(): Promise<DownloadedTranslationMeta[]>;
    renameTranslation(from: string, to: string): Promise<void>;
    deleteTranslation(identifier: string): Promise<void>;
  };
  settings: {
    getState(): {
      selectedTranslationId: string;
      setSelectedTranslationId: (id: string) => void;
    };
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
  const key = `${TRANSLATION_KEY_PREFIX}${id}`;
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
 * one is deleted and named in one notice; the selection is remapped. Safe to
 * rerun after a kill: renamed rows are numeric and only adopted again.
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
    if (QF_TRANSLATION_ID.test(id)) {
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

  const settings = deps.settings.getState();
  const selected = settings.selectedTranslationId;
  if (selected === RETIRED_SAHEEH_ID)
    await deps.registry.setState({translationAutoInstallKey: SAHEEH_KEY});
  const next = remapLegacyTranslationId(selected, true);
  if (next !== selected) settings.setSelectedTranslationId(next);

  if (removed.length > 0) deps.notifyRemoved(removed);
  await deps.registry.setState({translationsMigratedAt: deps.now});
  await deps.reload();
  return true;
}

/**
 * The maybeAutoInstall pattern for one translation key the migration queued
 * (Saheeh International as QF 20): installed once over any network. A user
 * removal, a legacy copy or an installed version settles it for good.
 */
export async function maybeAutoInstallTranslation(
  deps: EngineDeps,
): Promise<boolean> {
  const key = (await deps.registry.getState()).translationAutoInstallKey;
  if (key === null) return false;
  const row = await deps.registry.get(key);
  if (row && (row.user_removed || row.legacy || row.version > 0)) {
    await deps.registry.setState({translationAutoInstallKey: null});
    return false;
  }
  // A failed attempt left a placeholder with a backoff; wait it out.
  if (row && !retryIsDue(row.next_retry_at, deps.now())) return false;
  await reportInstall(key, () =>
    installResource(deps, key, 'translation', 'auto'),
  );
  const installed = await deps.registry.get(key);
  if (!installed || installed.version === 0) return false;
  await deps.registry.setState({translationAutoInstallKey: null});
  return true;
}
