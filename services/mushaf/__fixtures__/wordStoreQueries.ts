// @ai RFC-023 step 2: test-only.
/**
 * Lets a test's expo-sqlite fake answer the queries of
 * DigitalKhattDataService's WordStore. Such a fake returns the raw word rows
 * ({id, text, location}) for any words query; wrap the object that its
 * openDatabaseAsync returns:
 *
 *   return withWordStoreQueries({getFirstAsync, getAllAsync, closeAsync});
 *
 * The verse-index read (its GROUP BY) goes through the fake's own
 * getAllAsync, so read counts, gates and broken-file failures stay as they
 * were; its rows are kept, and the integrity counts and the synchronous id
 * range reads (getFirstSync) are answered from them. Not imported by app code.
 */
export interface FakeWordRow {
  id: number;
  text: string;
  location: string;
}

interface FakeDb {
  getFirstAsync(sql: string, ...rest: unknown[]): Promise<unknown>;
  getAllAsync(sql: string, ...rest: unknown[]): Promise<unknown>;
}

export function withWordStoreQueries<T extends FakeDb>(
  db: T,
): T & {
  getAllSync(sql: string, params?: unknown[]): FakeWordRow[];
  getFirstSync(sql: string, params?: unknown[]): {texts: string | null};
} {
  let rows: FakeWordRow[] = [];
  return {
    ...db,
    async getFirstAsync(sql: string, ...rest: unknown[]) {
      if (!sql.includes('COUNT(*)')) return db.getFirstAsync(sql, ...rest);
      const n = rows.length;
      return {n, ids: n, texts: n, locations: n};
    },
    async getAllAsync(sql: string, ...rest: unknown[]) {
      const result = await db.getAllAsync(sql, ...rest);
      if (!sql.includes('GROUP BY')) return result;
      rows = result as FakeWordRow[];
      return verseIndexRows(rows);
    },
    getAllSync(_sql: string, params: unknown[] = []) {
      const [from, to] = params.map(Number);
      return rows.filter(row => row.id >= from && row.id <= to);
    },
    // The chunk read: the texts of an id range in id order, joined by U+001F.
    getFirstSync(_sql: string, params: unknown[] = []) {
      const [from, to] = params.map(Number);
      const texts = rows
        .filter(row => row.id >= from && row.id <= to)
        .sort((a, b) => a.id - b.id)
        .map(row => row.text);
      return {texts: texts.length ? texts.join('\u001f') : null};
    },
  };
}

/** What the verse-index GROUP BY returns for `rows`. */
export function verseIndexRows(rows: readonly FakeWordRow[]) {
  const verses = new Map<
    string,
    {surah: number; ayah: number; first: number; last: number}
  >();
  for (const row of rows) {
    const [surah, ayah] = row.location.split(':').map(Number);
    const key = `${surah}:${ayah}`;
    const verse = verses.get(key);
    if (verse) {
      verse.first = Math.min(verse.first, row.id);
      verse.last = Math.max(verse.last, row.id);
    } else {
      verses.set(key, {surah, ayah, first: row.id, last: row.id});
    }
  }
  return [...verses.values()].sort((a, b) => a.first - b.first);
}
