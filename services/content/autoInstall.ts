import {isQfTranslationId} from '@/services/translation/translationRemap';
import type {ContentKind, Manifest} from '@/types/content';
import {installResource, retryIsDue, type EngineDeps} from './contentEngine';
import {keyFor} from './contentKeys';
import {reportInstall} from './installActivity';

// The manifest lists the key as active and is not paused (the kill switch).
export function manifestOffers(manifest: Manifest, key: string): boolean {
  if (manifest.paused) return false;
  return manifest.resources.some(
    item => item.key === key && item.status === 'active',
  );
}

// settled: a copy exists or the user removed it, so nothing was done.
// pending: an attempt failed now or earlier and waits out its backoff.
export type InstallOnceOutcome = 'settled' | 'pending' | 'installed';

/**
 * Installs one key the engine chose (not the user), over any network. Its row
 * settles it for good: an installed copy, a legacy copy (the check replaces
 * it), or a user removal. A failed attempt leaves a placeholder row with a
 * backoff, which the next call waits out, so this never loops.
 */
export async function installOnce(
  deps: EngineDeps,
  key: string,
  kind: ContentKind,
): Promise<InstallOnceOutcome> {
  const row = await deps.registry.get(key);
  if (row && (row.user_removed || row.legacy || row.version > 0))
    return 'settled';
  if (row && !retryIsDue(row.next_retry_at, deps.now())) return 'pending';
  await reportInstall(key, () => installResource(deps, key, kind, 'auto'));
  const installed = await deps.registry.get(key);
  return installed && installed.version > 0 ? 'installed' : 'pending';
}

/**
 * The selected translation installs once when it is a QF id the manifest
 * offers and has no copy: a "saheeh" selection remapped to QF 20, or an
 * edition chosen on another device. Null when the rule does not apply.
 */
export async function installSelectedTranslation(
  deps: EngineDeps,
  selectedId: string,
  manifest: Manifest | null,
): Promise<InstallOnceOutcome | null> {
  if (!deps.installers.translation || !isQfTranslationId(selectedId))
    return null;
  const key = keyFor('translation', selectedId);
  if (!manifest || !manifestOffers(manifest, key)) return null;
  return installOnce(deps, key, 'translation');
}
