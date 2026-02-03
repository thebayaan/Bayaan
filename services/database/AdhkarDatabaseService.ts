import * as SQLite from 'expo-sqlite';
import type {
  AdhkarCategory,
  Dhikr,
  DhikrFavorite,
  DhikrCount,
  AdhkarBroadTag,
  AdhkarSeedData,
  SuperCategory,
  SuperCategorySection,
} from '../../types/adhkar';

// Database row types (snake_case)
interface CategoryRow {
  id: string;
  title: string;
  dhikr_count: number;
}

interface DhikrRow {
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
  dhikr_id: string;
  created_at: number;
}

interface CountRow {
  dhikr_id: string;
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

interface SuperCategoryRow {
  id: string;
  title: string;
  arabic_title: string | null;
  color: string;
  height_multiplier: number;
  column: string;
  sort_order: number;
  section: string;
  category_ids: string; // JSON array stored as string
}

// Data version - increment when seed data changes to trigger re-seed
// Version 1: Initial adhkar data (267 items)
// Version 2: Added Quranic Duas (40 items, total 307)
// Version 3: Fixed audio file naming (dua_X.mp3 -> adhkar_X.mp3)
// Version 4: Added 99 Names of Allah (99 items, total 406)
const DATA_VERSION = 4;

class AdhkarDatabaseService {
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
        this.db = await SQLite.openDatabaseAsync('adhkar.db');
        await this.createTables();
      } catch (error) {
        console.error('Failed to initialize adhkar database:', error);
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
      CREATE TABLE IF NOT EXISTS adhkar_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        dhikr_count INTEGER DEFAULT 0
      );
    `);

    // Create tags table for filtering
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS adhkar_tags (
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

    // Create adhkar table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS adhkar (
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
      CREATE TABLE IF NOT EXISTS dhikr_favorites (
        dhikr_id TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Create tasbeeh counts table (daily reset via last_updated)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS dhikr_counts (
        dhikr_id TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        last_updated INTEGER
      );
    `);

    // Create super_categories table (Life With Allah-style groupings)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS super_categories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        arabic_title TEXT,
        color TEXT NOT NULL,
        height_multiplier REAL DEFAULT 1,
        column TEXT DEFAULT 'left',
        sort_order INTEGER DEFAULT 0,
        section TEXT DEFAULT 'main',
        category_ids TEXT NOT NULL
      );
    `);

    // Create meta table for version tracking
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS adhkar_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_adhkar_category ON adhkar(category_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_category_tags_category ON category_tags(category_id);
    `);

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_super_categories_section ON super_categories(section);
    `);
  }

  // Get current data version from database
  private async getDataVersion(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT value FROM adhkar_meta WHERE key = 'data_version'`,
    )) as {value: string} | null;

    return result ? parseInt(result.value, 10) : 0;
  }

  // Set data version in database
  private async setDataVersion(version: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO adhkar_meta (key, value) VALUES ('data_version', ?)`,
      [version.toString()],
    );
  }

  // Check if database needs re-seeding (version mismatch)
  async needsReseed(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const currentVersion = await this.getDataVersion();
    return currentVersion < DATA_VERSION;
  }

  // Update data version to current after successful seeding
  async updateDataVersion(): Promise<void> {
    await this.setDataVersion(DATA_VERSION);
  }

  // Get all categories with their tags
  async getAllCategories(): Promise<AdhkarCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const categories = (await this.db.getAllAsync(
      `SELECT id, title, dhikr_count FROM adhkar_categories ORDER BY title`,
    )) as CategoryRow[];

    // Get tags for each category
    const result: AdhkarCategory[] = [];
    for (const category of categories) {
      const tags = await this.getCategoryTags(category.id);
      result.push({
        id: category.id,
        title: category.title,
        dhikrCount: category.dhikr_count,
        broadTags: tags,
      });
    }

    return result;
  }

  // Get tags for a specific category
  private async getCategoryTags(categoryId: string): Promise<AdhkarBroadTag[]> {
    if (!this.db) throw new Error('Database not initialized');

    const tags = (await this.db.getAllAsync(
      `SELECT t.id as tag_id, t.name
       FROM adhkar_tags t
       JOIN category_tags ct ON t.id = ct.tag_id
       WHERE ct.category_id = ?`,
      [categoryId],
    )) as CategoryTagRow[];

    return tags.map(tag => tag.name as AdhkarBroadTag);
  }

  // Get categories filtered by tag
  async getCategoriesByTag(tag: AdhkarBroadTag): Promise<AdhkarCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const categories = (await this.db.getAllAsync(
      `SELECT DISTINCT c.id, c.title, c.dhikr_count
       FROM adhkar_categories c
       JOIN category_tags ct ON c.id = ct.category_id
       JOIN adhkar_tags t ON ct.tag_id = t.id
       WHERE t.name = ?
       ORDER BY c.title`,
      [tag],
    )) as CategoryRow[];

    // Get all tags for each category
    const result: AdhkarCategory[] = [];
    for (const category of categories) {
      const tags = await this.getCategoryTags(category.id);
      result.push({
        id: category.id,
        title: category.title,
        dhikrCount: category.dhikr_count,
        broadTags: tags,
      });
    }

    return result;
  }

  // Get all adhkar in a category
  async getAdhkarInCategory(categoryId: string): Promise<Dhikr[]> {
    if (!this.db) throw new Error('Database not initialized');

    const adhkar = (await this.db.getAllAsync(
      `SELECT * FROM adhkar WHERE category_id = ? ORDER BY sort_order`,
      [categoryId],
    )) as DhikrRow[];

    return adhkar.map(dhikr => ({
      id: dhikr.id,
      categoryId: dhikr.category_id,
      arabic: dhikr.arabic,
      translation: dhikr.translation,
      transliteration: dhikr.transliteration,
      instruction: dhikr.instruction,
      repeatCount: dhikr.repeat_count,
      audioFile: dhikr.audio_file,
      sortOrder: dhikr.sort_order,
    }));
  }

  // Get all adhkar for multiple category IDs (for super category view)
  async getAdhkarByCategoryIds(categoryIds: string[]): Promise<Dhikr[]> {
    if (!this.db) throw new Error('Database not initialized');
    if (categoryIds.length === 0) return [];

    // Build placeholders for IN clause
    const placeholders = categoryIds.map(() => '?').join(', ');

    const adhkar = (await this.db.getAllAsync(
      `SELECT * FROM adhkar WHERE category_id IN (${placeholders}) ORDER BY category_id, sort_order`,
      categoryIds,
    )) as DhikrRow[];

    return adhkar.map(dhikr => ({
      id: dhikr.id,
      categoryId: dhikr.category_id,
      arabic: dhikr.arabic,
      translation: dhikr.translation,
      transliteration: dhikr.transliteration,
      instruction: dhikr.instruction,
      repeatCount: dhikr.repeat_count,
      audioFile: dhikr.audio_file,
      sortOrder: dhikr.sort_order,
    }));
  }

  // Get a single dhikr by ID
  async getDhikr(id: string): Promise<Dhikr | null> {
    if (!this.db) throw new Error('Database not initialized');

    const dhikr = (await this.db.getFirstAsync(
      `SELECT * FROM adhkar WHERE id = ?`,
      [id],
    )) as DhikrRow | null;

    if (!dhikr) return null;

    return {
      id: dhikr.id,
      categoryId: dhikr.category_id,
      arabic: dhikr.arabic,
      translation: dhikr.translation,
      transliteration: dhikr.transliteration,
      instruction: dhikr.instruction,
      repeatCount: dhikr.repeat_count,
      audioFile: dhikr.audio_file,
      sortOrder: dhikr.sort_order,
    };
  }

  // Toggle favorite status for a dhikr
  async toggleFavorite(dhikrId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    let isFavorite = false;

    await db.withTransactionAsync(async () => {
      // Check if already favorited
      const existing = (await db.getFirstAsync(
        `SELECT dhikr_id FROM dhikr_favorites WHERE dhikr_id = ?`,
        [dhikrId],
      )) as FavoriteRow | null;

      if (existing) {
        // Remove from favorites
        await db.runAsync(`DELETE FROM dhikr_favorites WHERE dhikr_id = ?`, [
          dhikrId,
        ]);
        isFavorite = false;
      } else {
        // Add to favorites
        await db.runAsync(
          `INSERT INTO dhikr_favorites (dhikr_id, created_at) VALUES (?, ?)`,
          [dhikrId, Date.now()],
        );
        isFavorite = true;
      }
    });

    return isFavorite;
  }

  // Get all favorite dhikr IDs
  async getFavorites(): Promise<DhikrFavorite[]> {
    if (!this.db) throw new Error('Database not initialized');

    const favorites = (await this.db.getAllAsync(
      `SELECT dhikr_id, created_at FROM dhikr_favorites ORDER BY created_at DESC`,
    )) as FavoriteRow[];

    return favorites.map(fav => ({
      dhikrId: fav.dhikr_id,
      createdAt: fav.created_at,
    }));
  }

  // Get tasbeeh count for a dhikr (with daily reset logic)
  async getDhikrCount(dhikrId: string): Promise<DhikrCount | null> {
    if (!this.db) throw new Error('Database not initialized');

    const countRow = (await this.db.getFirstAsync(
      `SELECT dhikr_id, count, last_updated FROM dhikr_counts WHERE dhikr_id = ?`,
      [dhikrId],
    )) as CountRow | null;

    if (!countRow) return null;

    // Check if we need to reset (different day)
    const lastUpdated = new Date(countRow.last_updated);
    const now = new Date();

    if (lastUpdated.toDateString() !== now.toDateString()) {
      // Reset count for new day
      await this.updateDhikrCount(dhikrId, 0);
      return {
        dhikrId: countRow.dhikr_id,
        count: 0,
        lastUpdated: Date.now(),
      };
    }

    return {
      dhikrId: countRow.dhikr_id,
      count: countRow.count,
      lastUpdated: countRow.last_updated,
    };
  }

  // Update tasbeeh count for a dhikr
  async updateDhikrCount(dhikrId: string, count: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO dhikr_counts (dhikr_id, count, last_updated)
         VALUES (?, ?, ?)
         ON CONFLICT(dhikr_id) DO UPDATE SET count = ?, last_updated = ?`,
        [dhikrId, count, Date.now(), count, Date.now()],
      );
    });
  }

  // Get all super categories
  async getAllSuperCategories(): Promise<SuperCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM super_categories ORDER BY section, sort_order`,
    )) as SuperCategoryRow[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      arabicTitle: row.arabic_title,
      color: row.color,
      heightMultiplier: row.height_multiplier,
      column: row.column as 'left' | 'right',
      sortOrder: row.sort_order,
      section: row.section as SuperCategorySection,
      categoryIds: JSON.parse(row.category_ids),
    }));
  }

  // Get super categories by section
  async getSuperCategoriesBySection(
    section: SuperCategorySection,
  ): Promise<SuperCategory[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = (await this.db.getAllAsync(
      `SELECT * FROM super_categories WHERE section = ? ORDER BY sort_order`,
      [section],
    )) as SuperCategoryRow[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      arabicTitle: row.arabic_title,
      color: row.color,
      heightMultiplier: row.height_multiplier,
      column: row.column as 'left' | 'right',
      sortOrder: row.sort_order,
      section: row.section as SuperCategorySection,
      categoryIds: JSON.parse(row.category_ids),
    }));
  }

  // Get a single super category by ID
  async getSuperCategory(id: string): Promise<SuperCategory | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = (await this.db.getFirstAsync(
      `SELECT * FROM super_categories WHERE id = ?`,
      [id],
    )) as SuperCategoryRow | null;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      arabicTitle: row.arabic_title,
      color: row.color,
      heightMultiplier: row.height_multiplier,
      column: row.column as 'left' | 'right',
      sortOrder: row.sort_order,
      section: row.section as SuperCategorySection,
      categoryIds: JSON.parse(row.category_ids),
    };
  }

  // Check if super categories have been seeded
  async areSuperCategoriesSeeded(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM super_categories`,
    )) as CountCheckRow | null;

    return (result?.count ?? 0) > 0;
  }

  // Check if database has been seeded
  async isDatabaseSeeded(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = (await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM adhkar_categories`,
    )) as CountCheckRow | null;

    return (result?.count ?? 0) > 0;
  }

  // Seed database from JSON data
  async seedDatabase(data: AdhkarSeedData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;

    await db.withTransactionAsync(async () => {
      // Clear existing data
      await db.runAsync(`DELETE FROM category_tags`);
      await db.runAsync(`DELETE FROM adhkar_tags`);
      await db.runAsync(`DELETE FROM adhkar`);
      await db.runAsync(`DELETE FROM adhkar_categories`);

      // Insert categories
      for (const category of data.categories) {
        await db.runAsync(
          `INSERT INTO adhkar_categories (id, title, dhikr_count) VALUES (?, ?, ?)`,
          [category.id, category.title, category.dhikr_count],
        );

        // Insert tags for this category
        for (const tagName of category.broad_tags) {
          // Get or create tag
          let tag = (await db.getFirstAsync(
            `SELECT id, name FROM adhkar_tags WHERE name = ?`,
            [tagName],
          )) as TagRow | null;

          if (!tag) {
            const result = await db.runAsync(
              `INSERT INTO adhkar_tags (name) VALUES (?)`,
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

      // Insert adhkar
      for (const dhikr of data.adhkar) {
        await db.runAsync(
          `INSERT INTO adhkar (id, category_id, arabic, translation, transliteration, instruction, repeat_count, audio_file, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dhikr.id,
            dhikr.category_id,
            dhikr.arabic,
            dhikr.translation,
            dhikr.transliteration,
            dhikr.instruction,
            dhikr.repeat_count,
            dhikr.audio_file,
            dhikr.order_index,
          ],
        );
      }
    });
  }

  // Seed super categories
  async seedSuperCategories(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;

    // Define all super categories (Main)
    // Bento layout pattern - Left: 1, 2, 3, 1... (last=1) | Right: 1, 3, 1, 2... (last=2)
    const mainAdhkar = [
      {
        id: 'morning-adhkar',
        title: 'Morning',
        arabic_title: 'أذكار الصباح',
        color: '#F59E0B',
        height_multiplier: 1,
        column: 'left',
        sort_order: 1,
        section: 'main',
        category_ids: ['27'],
      },
      {
        id: 'evening-adhkar',
        title: 'Evening',
        arabic_title: 'أذكار المساء',
        color: '#4F46E5',
        height_multiplier: 1,
        column: 'right',
        sort_order: 1,
        section: 'main',
        category_ids: ['27'],
      },
      {
        id: 'salah',
        title: 'Salah',
        arabic_title: 'أذكار الصلاة',
        color: '#059669',
        height_multiplier: 2,
        column: 'left',
        sort_order: 2,
        section: 'main',
        category_ids: ['16', '17', '18', '19', '20', '21', '22', '23', '24'],
      },
      {
        id: 'before-sleep',
        title: 'Before Sleep',
        arabic_title: 'أذكار النوم',
        color: '#6366F1',
        height_multiplier: 3,
        column: 'right',
        sort_order: 2,
        section: 'main',
        category_ids: ['28', '29', '30', '31'],
      },
      {
        id: 'after-salah',
        title: 'After Salah',
        arabic_title: 'أذكار بعد الصلاة',
        color: '#10B981',
        height_multiplier: 3,
        column: 'left',
        sort_order: 3,
        section: 'main',
        category_ids: ['25', '32', '33'],
      },
      {
        id: 'waking-up',
        title: 'Waking Up',
        arabic_title: 'الاستيقاظ',
        color: '#F97316',
        height_multiplier: 1,
        column: 'right',
        sort_order: 3,
        section: 'main',
        category_ids: ['1'],
      },
      {
        id: 'salawat',
        title: 'Salawat',
        arabic_title: 'الصلاة على النبي',
        color: '#EC4899',
        height_multiplier: 1,
        column: 'left',
        sort_order: 4,
        section: 'main',
        category_ids: ['107'],
      },
      {
        id: 'praises-of-allah',
        title: 'Praises of Allah',
        arabic_title: 'الحمد والثناء',
        color: '#8B5CF6',
        height_multiplier: 2,
        column: 'right',
        sort_order: 4,
        section: 'main',
        category_ids: ['130', '131'],
      },
      {
        id: 'istighfar',
        title: 'Istighfar',
        arabic_title: 'الاستغفار',
        color: '#06B6D4',
        height_multiplier: 2,
        column: 'left',
        sort_order: 5,
        section: 'main',
        category_ids: ['44', '129'],
      },
      {
        id: 'nightmares',
        title: 'Nightmares',
        arabic_title: 'الكوابيس',
        color: '#7C3AED',
        height_multiplier: 3,
        column: 'right',
        sort_order: 5,
        section: 'main',
        category_ids: ['31'],
      },
      {
        id: 'protection-of-iman',
        title: 'Protection of Iman',
        arabic_title: 'حماية الإيمان',
        color: '#7C3AED',
        height_multiplier: 1,
        column: 'left',
        sort_order: 6,
        section: 'main',
        category_ids: ['40', '42', '45', '88', '92', '94', '128'],
      },
      {
        id: 'difficulties-happiness',
        title: 'Difficulties & Happiness',
        arabic_title: 'الشدة والفرح',
        color: '#F59E0B',
        height_multiplier: 2,
        column: 'right',
        sort_order: 6,
        section: 'main',
        category_ids: [
          '34',
          '35',
          '43',
          '46',
          '82',
          '106',
          '122',
          '123',
          '126',
        ],
      },
      {
        id: 'quranic-duas',
        title: 'Quranic Duas',
        arabic_title: 'أدعية قرآنية',
        color: '#0D9488',
        height_multiplier: 2,
        column: 'left',
        sort_order: 7,
        section: 'main',
        category_ids: ['quranic-duas'],
      },
    ];

    // Define all super categories (Other)
    // Bento layout pattern - Left: 1, 2, 3, 1... (last=1) | Right: 1, 3, 1, 2... (last=2)
    const otherAdhkar = [
      {
        id: 'names-of-allah',
        title: '99 Names of Allah',
        arabic_title: 'أسماء الله الحسنى',
        color: '#8B5CF6',
        height_multiplier: 2,
        column: 'left',
        sort_order: 0,
        section: 'other',
        category_ids: ['names-of-allah'],
      },
      {
        id: 'clothes',
        title: 'Clothes',
        arabic_title: 'اللباس',
        color: '#6366F1',
        height_multiplier: 1,
        column: 'left',
        sort_order: 1,
        section: 'other',
        category_ids: ['2', '3', '4', '5'],
      },
      {
        id: 'lavatory-wudu',
        title: 'Lavatory & Wudu',
        arabic_title: 'الخلاء والوضوء',
        color: '#6B7280',
        height_multiplier: 1,
        column: 'right',
        sort_order: 1,
        section: 'other',
        category_ids: ['6', '7', '8', '9'],
      },
      {
        id: 'adhan-masjid',
        title: 'Adhan & Masjid',
        arabic_title: 'الأذان والمسجد',
        color: '#059669',
        height_multiplier: 2,
        column: 'left',
        sort_order: 2,
        section: 'other',
        category_ids: ['12', '13', '14', '15'],
      },
      {
        id: 'home',
        title: 'Home',
        arabic_title: 'المنزل',
        color: '#F97316',
        height_multiplier: 3,
        column: 'right',
        sort_order: 2,
        section: 'other',
        category_ids: ['10', '11', '97', '98'],
      },
      {
        id: 'istikharah',
        title: 'Istikharah',
        arabic_title: 'الاستخارة',
        color: '#8B5CF6',
        height_multiplier: 3,
        column: 'left',
        sort_order: 3,
        section: 'other',
        category_ids: ['26'],
      },
      {
        id: 'gatherings',
        title: 'Gatherings',
        arabic_title: 'المجالس',
        color: '#EC4899',
        height_multiplier: 1,
        column: 'right',
        sort_order: 3,
        section: 'other',
        category_ids: ['84', '85'],
      },
      {
        id: 'food-drink',
        title: 'Food & Drink',
        arabic_title: 'الطعام والشراب',
        color: '#EF4444',
        height_multiplier: 1,
        column: 'left',
        sort_order: 4,
        section: 'other',
        category_ids: ['68', '69', '70', '71', '72', '73', '74', '75', '76'],
      },
      {
        id: 'travel',
        title: 'Travel',
        arabic_title: 'السفر',
        color: '#F59E0B',
        height_multiplier: 2,
        column: 'right',
        sort_order: 4,
        section: 'other',
        category_ids: [
          '95',
          '96',
          '99',
          '100',
          '101',
          '102',
          '103',
          '104',
          '105',
        ],
      },
      {
        id: 'nature',
        title: 'Nature',
        arabic_title: 'الطبيعة',
        color: '#06B6D4',
        height_multiplier: 2,
        column: 'left',
        sort_order: 5,
        section: 'other',
        category_ids: ['61', '62', '63', '64', '65', '66', '67', '110', '111'],
      },
      {
        id: 'social-interactions',
        title: 'Social Interactions',
        arabic_title: 'التعاملات الاجتماعية',
        color: '#EC4899',
        height_multiplier: 3,
        column: 'right',
        sort_order: 5,
        section: 'other',
        category_ids: [
          '36',
          '37',
          '38',
          '39',
          '77',
          '78',
          '86',
          '87',
          '89',
          '90',
          '91',
          '93',
          '108',
          '109',
          '112',
          '113',
          '114',
          '127',
        ],
      },
      {
        id: 'hajj-umrah',
        title: 'Hajj & Umrah',
        arabic_title: 'الحج والعمرة',
        color: '#F59E0B',
        height_multiplier: 3,
        column: 'left',
        sort_order: 6,
        section: 'other',
        category_ids: ['115', '116', '117', '118', '119', '120', '121'],
      },
      {
        id: 'marriage-children',
        title: 'Marriage & Children',
        arabic_title: 'الزواج والأولاد',
        color: '#EC4899',
        height_multiplier: 1,
        column: 'right',
        sort_order: 6,
        section: 'other',
        category_ids: ['47', '48', '79', '80', '81'],
      },
      {
        id: 'death',
        title: 'Death',
        arabic_title: 'الموت',
        color: '#6B7280',
        height_multiplier: 1,
        column: 'left',
        sort_order: 7,
        section: 'other',
        category_ids: [
          '51',
          '52',
          '53',
          '54',
          '55',
          '56',
          '57',
          '58',
          '59',
          '60',
        ],
      },
      {
        id: 'ruqyah-illness',
        title: 'Ruqyah & Illness',
        arabic_title: 'الرقية والمرض',
        color: '#10B981',
        height_multiplier: 2,
        column: 'right',
        sort_order: 7,
        section: 'other',
        category_ids: ['49', '50', '83', '124', '125'],
      },
      {
        id: 'money-shopping',
        title: 'Money & Shopping',
        arabic_title: 'المال والتسوق',
        color: '#F97316',
        height_multiplier: 1,
        column: 'left',
        sort_order: 8,
        section: 'other',
        category_ids: ['41'],
      },
    ];

    const allSuperCategories = [...mainAdhkar, ...otherAdhkar];

    await db.withTransactionAsync(async () => {
      // Clear existing super categories
      await db.runAsync(`DELETE FROM super_categories`);

      // Insert all super categories
      for (const cat of allSuperCategories) {
        await db.runAsync(
          `INSERT INTO super_categories (id, title, arabic_title, color, height_multiplier, column, sort_order, section, category_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.title,
            cat.arabic_title,
            cat.color,
            cat.height_multiplier,
            cat.column,
            cat.sort_order,
            cat.section,
            JSON.stringify(cat.category_ids),
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
export const adhkarDatabaseService = new AdhkarDatabaseService();
