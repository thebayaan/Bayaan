import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import type {
  AdhkarCategory,
  Dhikr,
  SavedDhikr,
  AdhkarBroadTag,
  AdhkarSeedData,
  SuperCategory,
  SuperCategorySection,
} from '@/types/adhkar';
import adhkarSeedData from '@/data/adhkar.json';
const seedData: AdhkarSeedData = adhkarSeedData;

// Re-export types for convenience
export type {
  AdhkarCategory,
  Dhikr,
  SavedDhikr,
  AdhkarBroadTag,
  SuperCategory,
  SuperCategorySection,
};

interface SuperCategoryGroup {
  categoryId: string;
  categoryTitle: string;
  adhkar: Dhikr[];
}

// Keeps list order; starts a new group whenever the category changes.
function groupConsecutiveByCategory(
  adhkar: Dhikr[],
  categories: AdhkarCategory[],
): SuperCategoryGroup[] {
  const groups: SuperCategoryGroup[] = [];
  for (const dhikr of adhkar) {
    const last = groups[groups.length - 1];
    if (last && last.categoryId === dhikr.categoryId) {
      last.adhkar.push(dhikr);
      continue;
    }
    const category = categories.find(c => c.id === dhikr.categoryId);
    if (!category) continue;
    groups.push({
      categoryId: category.id,
      categoryTitle: category.title,
      adhkar: [dhikr],
    });
  }
  return groups;
}

// A list can play its own recording of a shared dhikr (evening session).
function applyAudioOverrides(
  adhkar: Dhikr[],
  overrides: Readonly<Record<string, string>> | null,
): Dhikr[] {
  if (!overrides) return adhkar;
  return adhkar.map(dhikr =>
    Object.hasOwn(overrides, dhikr.id)
      ? {...dhikr, audioFile: overrides[dhikr.id]}
      : dhikr,
  );
}

class AdhkarService {
  private initPromise: Promise<void> | null = null;

  // Initialize database and seed if needed (idempotent with mutex protection)
  async initialize(): Promise<void> {
    // If initialization is in progress or completed, return the promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = (async () => {
      try {
        await adhkarDatabaseService.initialize();

        // Fresh install or data version change: replace all content and
        // store the new version in one transaction, so a failed or
        // interrupted reseed leaves the old data and retries next launch
        const needsReseed = await adhkarDatabaseService.needsReseed();
        if (needsReseed) {
          await adhkarDatabaseService.reseed(
            seedData,
            seedData.super_category_dhikr_ids ?? {},
            seedData.super_category_audio_overrides ?? {},
          );
          return;
        }

        // Seed database if empty
        const isSeeded = await adhkarDatabaseService.isDatabaseSeeded();
        if (!isSeeded) {
          await adhkarDatabaseService.seedDatabase(seedData);
        }

        // Seed super categories if empty
        const areSuperCategoriesSeeded =
          await adhkarDatabaseService.areSuperCategoriesSeeded();
        if (!areSuperCategoriesSeeded) {
          await adhkarDatabaseService.seedSuperCategories(
            seedData.super_category_dhikr_ids ?? {},
            seedData.super_category_audio_overrides ?? {},
          );
        }
      } catch (error) {
        console.error('Failed to initialize adhkar service:', error);
        this.initPromise = null; // Reset on error so it can be retried
        throw error;
      }
    })();

    return this.initPromise;
  }

  // ============================================
  // Categories
  // ============================================

  // Get all categories
  async getAllCategories(): Promise<AdhkarCategory[]> {
    await this.initialize();
    return await adhkarDatabaseService.getAllCategories();
  }

  // Get categories filtered by broad tag
  async getCategoriesByTag(tag: AdhkarBroadTag): Promise<AdhkarCategory[]> {
    await this.initialize();
    return await adhkarDatabaseService.getCategoriesByTag(tag);
  }

  // Get all categories grouped by their primary broad tag
  async getGroupedCategories(): Promise<
    Record<AdhkarBroadTag, AdhkarCategory[]>
  > {
    await this.initialize();

    const allCategories = await adhkarDatabaseService.getAllCategories();

    // Initialize groups for all broad tags
    const groups: Record<AdhkarBroadTag, AdhkarCategory[]> = {
      daily: [],
      prayer: [],
      protection: [],
      health: [],
      travel: [],
      food: [],
      social: [],
      nature: [],
      spiritual: [],
      home: [],
      clothing: [],
      general: [],
    };

    // Group categories by their primary (first) broad tag
    for (const category of allCategories) {
      if (category.broadTags.length > 0) {
        const primaryTag = category.broadTags[0];
        groups[primaryTag].push(category);
      } else {
        // If no tags, put in 'general'
        groups.general.push(category);
      }
    }

    return groups;
  }

  // ============================================
  // Super Categories
  // ============================================

  // Get all super categories
  async getAllSuperCategories(): Promise<SuperCategory[]> {
    await this.initialize();
    return await adhkarDatabaseService.getAllSuperCategories();
  }

  // Get super categories by section (main or other)
  async getSuperCategoriesBySection(
    section: SuperCategorySection,
  ): Promise<SuperCategory[]> {
    await this.initialize();
    return await adhkarDatabaseService.getSuperCategoriesBySection(section);
  }

  // Get a single super category by ID
  async getSuperCategory(id: string): Promise<SuperCategory | null> {
    await this.initialize();
    return await adhkarDatabaseService.getSuperCategory(id);
  }

  // Organize super categories by column for bento grid layout
  async organizeByColumn(categories: SuperCategory[]): Promise<{
    leftColumn: SuperCategory[];
    rightColumn: SuperCategory[];
  }> {
    const leftColumn = categories
      .filter(cat => cat.column === 'left')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const rightColumn = categories
      .filter(cat => cat.column === 'right')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {leftColumn, rightColumn};
  }

  // Check if a super category should skip the subcategory screen
  shouldSkipSubcategoryScreen(superCategory: SuperCategory): boolean {
    return superCategory.categoryIds.length === 1;
  }

  // Get the first category ID for direct navigation
  getFirstCategoryId(superCategory: SuperCategory): string | undefined {
    return superCategory.categoryIds[0];
  }

  // Get all adhkar for a super category, organized by category
  async getAdhkarForSuperCategory(superId: string): Promise<{
    superCategory: SuperCategory;
    categoryGroups: Array<{
      categoryId: string;
      categoryTitle: string;
      adhkar: Dhikr[];
    }>;
  } | null> {
    await this.initialize();

    const superCategory = await adhkarDatabaseService.getSuperCategory(superId);
    if (!superCategory) return null;

    // Get all categories
    const allCategories = await adhkarDatabaseService.getAllCategories();

    // Explicit ordered list (morning and evening): follow it exactly
    if (superCategory.dhikrIds) {
      const listed = await adhkarDatabaseService.getAdhkarByIds(
        superCategory.dhikrIds,
      );
      return {
        superCategory,
        categoryGroups: groupConsecutiveByCategory(
          applyAudioOverrides(listed, superCategory.audioOverrides),
          allCategories,
        ),
      };
    }

    // Get adhkar for all category IDs in this super category
    const adhkar = await adhkarDatabaseService.getAdhkarByCategoryIds(
      superCategory.categoryIds,
    );

    // Group adhkar by category
    const categoryGroups: Array<{
      categoryId: string;
      categoryTitle: string;
      adhkar: Dhikr[];
    }> = [];

    for (const categoryId of superCategory.categoryIds) {
      const category = allCategories.find(c => c.id === categoryId);
      const categoryAdhkar = adhkar.filter(d => d.categoryId === categoryId);

      if (category && categoryAdhkar.length > 0) {
        categoryGroups.push({
          categoryId: category.id,
          categoryTitle: category.title,
          adhkar: categoryAdhkar,
        });
      }
    }

    return {superCategory, categoryGroups};
  }

  // ============================================
  // Adhkar
  // ============================================

  // Get all adhkar in a category
  async getAdhkarInCategory(categoryId: string): Promise<Dhikr[]> {
    await this.initialize();
    return await adhkarDatabaseService.getAdhkarInCategory(categoryId);
  }

  // Get a single dhikr by ID
  async getDhikr(id: string): Promise<Dhikr | null> {
    await this.initialize();
    return await adhkarDatabaseService.getDhikr(id);
  }

  // Get adjacent adhkar for swipe navigation
  async getAdjacentAdhkar(
    categoryId: string,
    currentIndex: number,
  ): Promise<{prev: Dhikr | null; next: Dhikr | null}> {
    await this.initialize();

    const adhkar = await adhkarDatabaseService.getAdhkarInCategory(categoryId);

    return {
      prev: currentIndex > 0 ? adhkar[currentIndex - 1] : null,
      next: currentIndex < adhkar.length - 1 ? adhkar[currentIndex + 1] : null,
    };
  }

  // ============================================
  // Saved Adhkar
  // ============================================

  // Toggle saved status for a dhikr
  async toggleSaved(dhikrId: string): Promise<boolean> {
    await this.initialize();
    return await adhkarDatabaseService.toggleSaved(dhikrId);
  }

  // Get all saved adhkar
  async getSaved(): Promise<SavedDhikr[]> {
    await this.initialize();
    return await adhkarDatabaseService.getSaved();
  }

  // Check if a dhikr is saved
  async isSaved(dhikrId: string): Promise<boolean> {
    await this.initialize();
    const saved = await adhkarDatabaseService.getSaved();
    return saved.some(s => s.dhikrId === dhikrId);
  }

  // ============================================
  // Tasbeeh Counts (with daily reset)
  // ============================================
  // countKey is the plain dhikr id, or `<superId>:<dhikrId>` inside the
  // morning and evening lists (see dhikrCountKey).

  // Get the current count for a count key (resets daily)
  async getDhikrCount(countKey: string): Promise<number> {
    await this.initialize();
    const countData = await adhkarDatabaseService.getDhikrCount(countKey);
    return countData?.count ?? 0;
  }

  // Increment the count for a count key and return the new count
  async incrementDhikrCount(countKey: string): Promise<number> {
    await this.initialize();

    // Get current count (this handles daily reset)
    const currentCount = await this.getDhikrCount(countKey);
    const newCount = currentCount + 1;

    // Update the count
    await adhkarDatabaseService.updateDhikrCount(countKey, newCount);

    return newCount;
  }

  // Reset the count for a count key to zero
  async resetDhikrCount(countKey: string): Promise<void> {
    await this.initialize();
    await adhkarDatabaseService.updateDhikrCount(countKey, 0);
  }

  // Get all of today's counts at once (for store initialization), keyed by
  // count key. Reads every row, so per-list keys survive a reseed.
  async getAllCounts(): Promise<Record<string, number>> {
    await this.initialize();

    const counts: Record<string, number> = {};
    for (const row of await adhkarDatabaseService.getTodayDhikrCounts()) {
      counts[row.dhikrId] = row.count;
    }
    return counts;
  }
}

// Export singleton instance
export const adhkarService = new AdhkarService();
