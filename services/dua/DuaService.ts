import {duaDatabaseService} from '@/services/database/DuaDatabaseService';
import type {
  DuaCategory,
  Dua,
  DuaFavorite,
  DuaBroadTag,
  DuaSeedData,
} from '@/types/dua';
import duaSeedData from '@/data/duas.json';

// Re-export types for convenience
export type {DuaCategory, Dua, DuaFavorite, DuaBroadTag};

class DuaService {
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
        await duaDatabaseService.initialize();

        // Seed database if empty
        const isSeeded = await duaDatabaseService.isDatabaseSeeded();
        if (!isSeeded) {
          await duaDatabaseService.seedDatabase(duaSeedData as DuaSeedData);
        }
      } catch (error) {
        console.error('Failed to initialize dua service:', error);
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
  async getAllCategories(): Promise<DuaCategory[]> {
    await this.initialize();
    return await duaDatabaseService.getAllCategories();
  }

  // Get categories filtered by broad tag
  async getCategoriesByTag(tag: DuaBroadTag): Promise<DuaCategory[]> {
    await this.initialize();
    return await duaDatabaseService.getCategoriesByTag(tag);
  }

  // Get all categories grouped by their primary broad tag
  async getGroupedCategories(): Promise<Record<DuaBroadTag, DuaCategory[]>> {
    await this.initialize();

    const allCategories = await duaDatabaseService.getAllCategories();

    // Initialize groups for all broad tags
    const groups: Record<DuaBroadTag, DuaCategory[]> = {
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
  // Duas
  // ============================================

  // Get all duas in a category
  async getDuasInCategory(categoryId: string): Promise<Dua[]> {
    await this.initialize();
    return await duaDatabaseService.getDuasInCategory(categoryId);
  }

  // Get a single dua by ID
  async getDua(id: string): Promise<Dua | null> {
    await this.initialize();
    return await duaDatabaseService.getDua(id);
  }

  // Get adjacent duas for swipe navigation
  async getAdjacentDuas(
    categoryId: string,
    currentIndex: number,
  ): Promise<{prev: Dua | null; next: Dua | null}> {
    await this.initialize();

    const duas = await duaDatabaseService.getDuasInCategory(categoryId);

    return {
      prev: currentIndex > 0 ? duas[currentIndex - 1] : null,
      next: currentIndex < duas.length - 1 ? duas[currentIndex + 1] : null,
    };
  }

  // ============================================
  // Favorites
  // ============================================

  // Toggle favorite status for a dua
  async toggleFavorite(duaId: string): Promise<boolean> {
    await this.initialize();
    return await duaDatabaseService.toggleFavorite(duaId);
  }

  // Get all favorites
  async getFavorites(): Promise<DuaFavorite[]> {
    await this.initialize();
    return await duaDatabaseService.getFavorites();
  }

  // Check if a dua is favorited
  async isFavorite(duaId: string): Promise<boolean> {
    await this.initialize();
    const favorites = await duaDatabaseService.getFavorites();
    return favorites.some(fav => fav.duaId === duaId);
  }

  // ============================================
  // Tasbeeh Counts (with daily reset)
  // ============================================

  // Get the current count for a dua (resets daily)
  async getDuaCount(duaId: string): Promise<number> {
    await this.initialize();
    const countData = await duaDatabaseService.getDuaCount(duaId);
    return countData?.count ?? 0;
  }

  // Increment the count for a dua and return the new count
  async incrementDuaCount(duaId: string): Promise<number> {
    await this.initialize();

    // Get current count (this handles daily reset)
    const currentCount = await this.getDuaCount(duaId);
    const newCount = currentCount + 1;

    // Update the count
    await duaDatabaseService.updateDuaCount(duaId, newCount);

    return newCount;
  }

  // Reset the count for a dua to zero
  async resetDuaCount(duaId: string): Promise<void> {
    await this.initialize();
    await duaDatabaseService.updateDuaCount(duaId, 0);
  }

  // Get all counts at once (for store initialization)
  async getAllCounts(): Promise<Record<string, number>> {
    await this.initialize();

    // Get all duas to know which IDs to check
    const allCategories = await duaDatabaseService.getAllCategories();
    const counts: Record<string, number> = {};

    // Get duas for each category and their counts
    for (const category of allCategories) {
      const duas = await duaDatabaseService.getDuasInCategory(category.id);
      for (const dua of duas) {
        const count = await this.getDuaCount(dua.id);
        if (count > 0) {
          counts[dua.id] = count;
        }
      }
    }

    return counts;
  }
}

// Export singleton instance
export const duaService = new DuaService();
