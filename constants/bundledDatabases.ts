// @ai-generated
/**
 * File names of bundled SQLite databases that more than one part of the
 * app reads. A bundled database is imported once per name (expo-sqlite
 * keeps an existing copy), so a rebuilt file ships under a new name: change
 * it here, rename the file under assets/data and update its require() in
 * the service that imports it (Metro needs the path written out there).
 */

/**
 * The i'rab and morphology database (scripts/irab/build-irab-db.ts), opened
 * under this name by services/irab/IrabDataService.ts and read, for its
 * morphology only, by the Quran search index build
 * (scripts/search/build-quran-search-db.ts). The service's require() writes
 * the file name out for Metro; services/search/__tests__/bundledDatabases
 * .test.ts fails when the name it opens or the asset it imports is not this
 * one.
 */
export const IRAB_DB_NAME = 'irab-v2.db';
