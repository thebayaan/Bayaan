// @ai-generated
/**
 * The word-study databases this build ships (scripts/word-study/README.md).
 * null: the kind does not ship, its section never shows and no SQLite file
 * is opened. A rebuilt database ships under a new name (gharib-v2.db) with
 * the names it replaces in `old`, because a bundled database is imported
 * only once per name.
 */
export interface BundledDb {
  name: string;
  /** The asset, `require('…/<name>')`. */
  assetId: number;
  /** Earlier names of this database, deleted after the import. */
  old: readonly string[];
}

export interface BundledWordStudy {
  gharib: BundledDb | null;
  rasm: BundledDb | null;
}

export const BUNDLED_WORD_STUDY: Readonly<BundledWordStudy> = {
  gharib: null,
  rasm: null,
};
