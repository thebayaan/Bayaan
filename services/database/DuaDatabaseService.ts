import * as SQLite from 'expo-sqlite';
import type {
  DuaCategory,
  Dua,
  DuaFavorite,
  DuaCount,
  DuaBroadTag,
  DuaSeedData,
} from '../../types/dua';

// Database row types (snake_case)
interface CategoryRow {
  id: string;
  title: string;
  dua_count: number;
}

interface DuaRow {
  id: string;
  category_id: string;
  arabic: string;
  translation: string | null;
  transliteration: string | null;
  instruction: string | null;
  repeat_count: number;
  audio_file: string | null;
  sort_order: number;
}

interface FavoriteRow {
  dua_id: string;
  created_at: number;
}

interface CountRow {
  dua_id: string;
  count: number;
  last_updated: number;
}

interface TagRow {
  id: number;
  name: string;
}

interface CategoryTagRow {
  tag_id: number;
  name: string;
}

interface CountCheckRow {
  count: number;
}

class DuaDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // Initialize database (idempotent with mutex protection)
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) return;

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = (async () => {
      try {
        this.db = await SQLite.openDatabaseAsync('duas.db');
        await this.createTables();
      } catch (error) {
        console.error('Failed to initialize dua database:', error);
        this.initPromise = null; // Reset on error so it can be retried
        throw error;
      }
    })();

    return this.initPromise;
  }

  // Create tables
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Enable WAL mode for better concurrent access
    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    // Create categories table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dua_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        dua_count INTEGER DEFAULT 0
      );
    `);

    // Create tags table for filtering
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dua_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
    `);

    // Create many-to-many relationship table for categories to tags
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS category_tags (
        category_id TEXT,
        tag_id INTEGER,
        PRIMARY KEY (category_id, tag_id)
      );
    `);

    // Create duas table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS duas (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        arabic TEXT NOT NULL,
        translation TEXT,
        transliteration TEXT,
        instruction TEXT,
        repeat_count INTEGER DEFAULT 1,
        audio_file TEXT,
        sort_order INTEGER DEFAULT 0
      );
    `);

    // Create user favorites table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dua_favorites (
        dua_id TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Create tasbeeh counts table (daily reset via last_updated)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dua_counts (
        dua_id TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        last_updated INTEGER
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_duas_category ON duas(category_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_category_tags_category ON category_tags(category_id);
    `);
  }

  // Get all categories with their tags
  async getAllCategories(): Promise<DuaCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const categories = (await this.db.getAllAsync(
      `SELECT id, title, dua_count FROM dua_categories ORDER BY title`,
    )) as CategoryRow[];

    // Get tags for each category
    const result: DuaCategory[] = [];
    for (const category of categories) {
      const tags = await this.getCategoryTags(category.id);
      result.push({
        id: category.id,
        title: category.title,
        duaCount: category.dua_count,
        broadTags: tags,
      });
    }

    return result;
  }

  // Get tags for a specific category
  private async getCategoryTags(categoryId: string): Promise<DuaBroadTag[]> {
    if (!this.db) throw new Error('Database not initialized');

    const tags = (await this.db.getAllAsync(
      `SELECT t.id as tag_id, t.name
       FROM dua_tags t
       JOIN category_tags ct ON t.id = ct.tag_id
       WHERE ct.category_id = ?`,
      [categoryId],
    )) as CategoryTagRow[];

    return tags.map(tag => tag.name as DuaBroadTag);
  }

  // Get categories filtered by tag
  async getCategoriesByTag(tag: DuaBroadTag): Promise<DuaCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const categories = (await this.db.getAllAsync(
      `SELECT DISTINCT c.id, c.title, c.dua_count
       FROM dua_categories c
       JOIN category_tags ct ON c.id = ct.category_id
       JOIN dua_tags t ON ct.tag_id = t.id
       WHERE t.name = ?
       ORDER BY c.title`,
      [tag],
    )) as CategoryRow[];

    // Get all tags for each category
    const result: DuaCategory[] = [];
    for (const category of categories) {
      const tags = await this.getCategoryTags(category.id);
      result.push({
        id: category.id,
        title: category.title,
        duaCount: category.dua_count,
        broadTags: tags,
      });
    }

    return result;
  }

  // Get all duas in a category
  async getDuasInCategory(categoryId: string): Promise<Dua[]> {
    if (!this.db) throw new Error('Database not initialized');

    const duas = (await this.db.getAllAsync(
      `SELECT * FROM duas WHERE category_id = ? ORDER BY sort_order`,
      [categoryId],
    )) as DuaRow[];

    return duas.map(dua => ({
      id: dua.id,
      categoryId: dua.category_id,
      arabic: dua.arabic,
      translation: dua.translation,
      transliteration: dua.transliteration,
      instruction: dua.instruction,
      repeatCount: dua.repeat_count,
      audioFile: dua.audio_file,
      sortOrder: dua.sort_order,
    }));
  }

  // Get a single dua by ID
  async getDua(id: string): Promise<Dua | null> {
    if (!this.db) throw new Error('Database not initialized');

    const dua = (await this.db.getFirstAsync(
      `SELECT * FROM duas WHERE id = ?`,
      [id],
    )) as DuaRow | null;

    if (!dua) return null;

    return {
      id: dua.id,
      categoryId: dua.category_id,
      arabic: dua.arabic,
      translation: dua.translation,
      transliteration: dua.transliteration,
      instruction: dua.instruction,
      repeatCount: dua.repeat_count,
      audioFile: dua.audio_file,
      sortOrder: dua.sort_order,
    };
  }

  // Toggle favorite status for a dua
  async toggleFavorite(duaId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    let isFavorite = false;

    await db.withTransactionAsync(async () => {
      // Check if already favorited
      const existing = (await db.getFirstAsync(
        `SELECT dua_id FROM dua_favorites WHERE dua_id = ?`,
        [duaId],
      )) as FavoriteRow | null;

      if (existing) {
        // Remove from favorites
        await db.runAsync(`DELETE FROM dua_favorites WHERE dua_id = ?`, [
          duaId,
        ]);
        isFavorite = false;
      } else {
        // Add to favorites
        await db.runAsync(
          `INSERT INTO dua_favorites (dua_id, created_at) VALUES (?, ?)`,
          [duaId, Date.now()],
        );
        isFavorite = true;
      }
    });

    return isFavorite;
  }

  // Get all favorite dua IDs
  async getFavorites(): Promise<DuaFavorite[]> {
    if (!this.db) throw new Error('Database not initialized');

    const favorites = (await this.db.getAllAsync(
      `SELECT dua_id, created_at FROM dua_favorites ORDER BY created_at DESC`,
    )) as FavoriteRow[];

    return favorites.map(fav => ({
      duaId: fav.dua_id,
      createdAt: fav.created_at,
    }));
  }

  // Get tasbeeh count for a dua (with daily reset logic)
  async getDuaCount(duaId: string): Promise<DuaCount | null> {
    if (!this.db) throw new Error('Database not initialized');

    const countRow = (await this.db.getFirstAsync(
      `SELECT dua_id, count, last_updated FROM dua_counts WHERE dua_id = ?`,
      [duaId],
    )) as CountRow | null;

    if (!countRow) return null;

    // Check if we need to reset (different day)
    const lastUpdated = new Date(countRow.last_updated);
    const now = new Date();

    if (lastUpdated.toDateString() !== now.toDateString()) {
      // Reset count for new day
      await this.updateDuaCount(duaId, 0);
      return {
        duaId: countRow.dua_id,
        count: 0,
        lastUpdated: Date.now(),
      };
    }

    return {
      duaId: countRow.dua_id,
      count: countRow.count,
      lastUpdated: countRow.last_updated,
    };
  }

  // Update tasbeeh count for a dua
  async updateDuaCount(duaId: string, count: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO dua_counts (dua_id, count, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(dua_id) DO UPDATE SET count = ?, last_updated = ?`,
        [duaId, count, Date.now(), count, Date.now()],
      );
    });
  }

  // Check if database has been seeded
  async isDatabaseSeeded(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM dua_categories`,
    )) as CountCheckRow | null;

    return (result?.count ?? 0) > 0;
  }

  // Seed database from JSON data
  async seedDatabase(data: DuaSeedData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;

    await db.withTransactionAsync(async () => {
      // Clear existing data
      await db.runAsync(`DELETE FROM category_tags`);
      await db.runAsync(`DELETE FROM dua_tags`);
      await db.runAsync(`DELETE FROM duas`);
      await db.runAsync(`DELETE FROM dua_categories`);

      // Insert categories
      for (const category of data.categories) {
        await db.runAsync(
          `INSERT INTO dua_categories (id, title, dua_count) VALUES (?, ?, ?)`,
          [category.id, category.title, category.dua_count],
        );

        // Insert tags for this category
        for (const tagName of category.broad_tags) {
          // Get or create tag
          let tag = (await db.getFirstAsync(
            `SELECT id, name FROM dua_tags WHERE name = ?`,
            [tagName],
          )) as TagRow | null;

          if (!tag) {
            const result = await db.runAsync(
              `INSERT INTO dua_tags (name) VALUES (?)`,
              [tagName],
            );
            tag = {id: result.lastInsertRowId, name: tagName};
          }

          // Link category to tag
          await db.runAsync(
            `INSERT OR IGNORE INTO category_tags (category_id, tag_id) VALUES (?, ?)`,
            [category.id, tag.id],
          );
        }
      }

      // Insert duas
      for (const dua of data.duas) {
        await db.runAsync(
          `INSERT INTO duas (id, category_id, arabic, translation, transliteration, instruction, repeat_count, audio_file, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dua.id,
            dua.category_id,
            dua.arabic,
            dua.translation,
            dua.transliteration,
            dua.instruction,
            dua.repeat_count,
            dua.audio_file,
            dua.order_index,
          ],
        );
      }
    });
  }

  // Close database
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Export singleton instance
export const duaDatabaseService = new DuaDatabaseService();
