import {Reciter} from '@/data/reciterData';

/**
 * Abstraction over the reciter catalog.
 *
 * The default implementation wraps the static RECITERS array in reciterData.ts.
 * A fork can supply its own catalog by calling setCatalogProvider() (exported from
 * data/defaultCatalogProvider.ts) at app boot, then reading via getCatalogProvider()
 * wherever the catalog is consumed.
 *
 * See docs/rfcs/007-app-layer-multi-tenancy.md.
 */
export interface CatalogProvider {
  getAllReciters(): Reciter[];
  getReciterById(id: string): Reciter | undefined;
}
