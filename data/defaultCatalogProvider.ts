import {RECITERS} from './reciterData';
import {CatalogProvider} from '@/types/CatalogProvider';

export const defaultCatalogProvider: CatalogProvider = {
  getAllReciters: () => RECITERS,
  getReciterById: id => RECITERS.find(r => r.id === id),
};

let _activeProvider: CatalogProvider = defaultCatalogProvider;

/**
 * Replace the active catalog provider.
 * Call at app boot (e.g. in app/_layout.tsx) before any component reads the catalog.
 * Bayaan itself never calls this; it is provided for forks that supply a different
 * reciter catalog.
 */
export function setCatalogProvider(provider: CatalogProvider): void {
  _activeProvider = provider;
}

/**
 * Returns the active catalog provider.
 * Application code should call this instead of importing defaultCatalogProvider
 * directly so that forks can inject their own catalog via setCatalogProvider().
 */
export function getCatalogProvider(): CatalogProvider {
  return _activeProvider;
}
