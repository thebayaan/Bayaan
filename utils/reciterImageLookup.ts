// @ai-generated
import {reciterImages} from './reciterImages';
import {bundledImageKey, reciterImageKey} from './reciterImageKey';

export {reciterImageKey};

/**
 * The bundled photo for a reciter, if the app ships one, as the asset id that
 * `require` returns.
 */
export function getLocalReciterImage(
  name: string | null | undefined,
): number | undefined {
  if (!name) return undefined;
  return reciterImages[bundledImageKey(name)];
}
