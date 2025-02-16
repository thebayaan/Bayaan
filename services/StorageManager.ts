import AsyncStorage from '@react-native-async-storage/async-storage';
import {performance} from '@/utils/performance';

interface StorageOperation {
  key: string;
  value: string | null;
  type: 'set' | 'remove';
  priority: 'high' | 'normal' | 'low';
  resolve: (value: void) => void;
  reject: (reason?: unknown) => void;
}

export class StorageManager {
  private static instance: StorageManager;
  private batchQueue: StorageOperation[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 1000; // 1 second
  private readonly HIGH_PRIORITY_DELAY = 100; // 100ms for high priority
  private isProcessing = false;

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async set<T>(
    key: string,
    value: T,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<void> {
    const start = performance.now();
    try {
      return new Promise<void>((resolve, reject) => {
        this.batchQueue.push({
          key,
          value: JSON.stringify(value),
          type: 'set',
          priority,
          resolve,
          reject,
        });
        this.scheduleBatch(priority);
      });
    } catch (error) {
      console.error(`[StorageManager] Error setting ${key}:`, error);
      throw error;
    } finally {
      const duration = performance.now() - start;
      if (duration > 16) {
        console.warn(
          `[StorageManager] Slow set operation for ${key}: ${duration}ms`,
        );
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const start = performance.now();
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      console.error(`[StorageManager] Error getting ${key}:`, error);
      throw error;
    } finally {
      const duration = performance.now() - start;
      if (duration > 16) {
        console.warn(
          `[StorageManager] Slow get operation for ${key}: ${duration}ms`,
        );
      }
    }
  }

  async remove(
    key: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.batchQueue.push({
        key,
        value: null,
        type: 'remove',
        priority,
        resolve,
        reject,
      });
      this.scheduleBatch(priority);
    });
  }

  private scheduleBatch(priority: 'high' | 'normal' | 'low'): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    const delay =
      priority === 'high' ? this.HIGH_PRIORITY_DELAY : this.BATCH_DELAY;
    this.batchTimeout = setTimeout(() => this.processBatch(), delay);
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.batchQueue.length === 0) return;

    this.isProcessing = true;
    const operations = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // Process high priority operations first
      const highPriority = operations.filter(op => op.priority === 'high');
      const normalPriority = operations.filter(op => op.priority === 'normal');
      const lowPriority = operations.filter(op => op.priority === 'low');

      // Process in order of priority
      await this.processOperations(highPriority);
      await this.processOperations(normalPriority);
      await this.processOperations(lowPriority);
    } finally {
      this.isProcessing = false;
      // Check if new operations were added during processing
      if (this.batchQueue.length > 0) {
        this.scheduleBatch('normal');
      }
    }
  }

  private async processOperations(
    operations: StorageOperation[],
  ): Promise<void> {
    if (operations.length === 0) return;

    try {
      const setOperations = operations.filter(op => op.type === 'set');
      const removeOperations = operations.filter(op => op.type === 'remove');

      // Batch all set operations
      if (setOperations.length > 0) {
        const multiSet: [string, string][] = setOperations
          .filter(
            (op): op is StorageOperation & {value: string} => op.value !== null,
          )
          .map(({key, value}) => [key, value]);

        if (multiSet.length > 0) {
          await AsyncStorage.multiSet(multiSet);
          setOperations.forEach(op => op.resolve());
        }
      }

      // Batch all remove operations
      if (removeOperations.length > 0) {
        const keys = removeOperations.map(op => op.key);
        await AsyncStorage.multiRemove(keys);
        removeOperations.forEach(op => op.resolve());
      }
    } catch (error) {
      operations.forEach(op => op.reject(error));
      console.error('[StorageManager] Error processing batch:', error);
    }
  }

  // Helper method to create a storage interface compatible with Zustand persist middleware
  createStorage() {
    return {
      getItem: async (name: string): Promise<string | null> => {
        const value = await this.get<string>(name);
        return value ? JSON.stringify(value) : null;
      },
      setItem: async (name: string, value: string): Promise<void> => {
        return this.set(name, JSON.parse(value));
      },
      removeItem: async (name: string): Promise<void> => {
        return this.remove(name);
      },
    };
  }
}
