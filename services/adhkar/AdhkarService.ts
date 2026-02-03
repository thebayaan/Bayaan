import {adhkarDatabaseService} from '@/services/database/AdhkarDatabaseService';
import type {
  AdhkarCategory,
  Dhikr,
  DhikrFavorite,
  AdhkarBroadTag,
  AdhkarSeedData,
  SuperCategory,
  SuperCategorySection,
} from '@/types/adhkar';
import adhkarSeedData from '@/data/adhkar.json';

// Re-export types for convenience
export type {
  AdhkarCategory,
  Dhikr,
  DhikrFavorite,
  AdhkarBroadTag,
  SuperCategory,
  SuperCategorySection,
};

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

        // Seed database if empty
        const isSeeded = await adhkarDatabaseService.isDatabaseSeeded();
        if (!isSeeded) {
          await adhkarDatabaseService.seedDatabase(
            adhkarSeedData as AdhkarSeedData,
          );
        }

        // Seed super categories if empty
        const areSuperCategoriesSeeded =
          await adhkarDatabaseService.areSuperCategoriesSeeded();
        if (!areSuperCategoriesSeeded) {
          await adhkarDatabaseService.seedSuperCategories();
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
  // Favorites
  // ============================================

  // Toggle favorite status for a dhikr
  async toggleFavorite(dhikrId: string): Promise<boolean> {
    await this.initialize();
    return await adhkarDatabaseService.toggleFavorite(dhikrId);
  }

  // Get all favorites
  async getFavorites(): Promise<DhikrFavorite[]> {
    await this.initialize();
    return await adhkarDatabaseService.getFavorites();
  }

  // Check if a dhikr is favorited
  async isFavorite(dhikrId: string): Promise<boolean> {
    await this.initialize();
    const favorites = await adhkarDatabaseService.getFavorites();
    return favorites.some(fav => fav.dhikrId === dhikrId);
  }

  // ============================================
  // Tasbeeh Counts (with daily reset)
  // ============================================

  // Get the current count for a dhikr (resets daily)
  async getDhikrCount(dhikrId: string): Promise<number> {
    await this.initialize();
    const countData = await adhkarDatabaseService.getDhikrCount(dhikrId);
    return countData?.count ?? 0;
  }

  // Increment the count for a dhikr and return the new count
  async incrementDhikrCount(dhikrId: string): Promise<number> {
    await this.initialize();

    // Get current count (this handles daily reset)
    const currentCount = await this.getDhikrCount(dhikrId);
    const newCount = currentCount + 1;

    // Update the count
    await adhkarDatabaseService.updateDhikrCount(dhikrId, newCount);

    return newCount;
  }

  // Reset the count for a dhikr to zero
  async resetDhikrCount(dhikrId: string): Promise<void> {
    await this.initialize();
    await adhkarDatabaseService.updateDhikrCount(dhikrId, 0);
  }

  // Get all counts at once (for store initialization)
  async getAllCounts(): Promise<Record<string, number>> {
    await this.initialize();

    // Get all adhkar to know which IDs to check
    const allCategories = await adhkarDatabaseService.getAllCategories();
    const counts: Record<string, number> = {};

    // Get adhkar for each category and their counts
    for (const category of allCategories) {
      const adhkar = await adhkarDatabaseService.getAdhkarInCategory(
        category.id,
      );
      for (const dhikr of adhkar) {
        const count = await this.getDhikrCount(dhikr.id);
        if (count > 0) {
          counts[dhikr.id] = count;
        }
      }
    }

    return counts;
  }
}

// Export singleton instance
export const adhkarService = new AdhkarService();
