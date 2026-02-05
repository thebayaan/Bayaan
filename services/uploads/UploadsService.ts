import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {uploadsDatabaseService} from './UploadsDatabaseService';
import type {UploadedRecitation, CustomReciter} from '../../types/uploads';

// ─── Constants ──────────────────────────────────────────────────────────────

const UPLOADS_DIR = 'user-recitations/';
const LARGE_FILE_WARNING_BYTES = 100 * 1024 * 1024; // 100MB
const ORPHAN_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const ORPHAN_CHECK_KEY = 'uploads_last_orphan_check';

// ─── Utilities ──────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function resolveRecitationPath(filePath: string): string {
  return `${FileSystem.documentDirectory}${UPLOADS_DIR}${filePath}`;
}

function getFileExtension(uri: string): string {
  const match = uri.match(/\.(\w+)(?:\?.*)?$/);
  return match ? `.${match[1]}` : '.mp3';
}

// ─── Service ────────────────────────────────────────────────────────────────

class UploadsService {
  private initPromise: Promise<void> | null = null;

  // Initialize the service (idempotent with mutex protection)
  async initialize(): Promise<void> {
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = uploadsDatabaseService.initialize();
    return this.initPromise;
  }

  // ─── Directory Management ───────────────────────────────────────────

  async ensureUploadsDirectory(): Promise<void> {
    const dirPath = `${FileSystem.documentDirectory}${UPLOADS_DIR}`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, {intermediates: true});
    }
  }

  // ─── File Import ───────────────────────────────────────────────────

  async importFile(
    sourceUri: string,
    originalFilename: string,
  ): Promise<UploadedRecitation> {
    await this.initialize();
    await this.ensureUploadsDirectory();

    // Generate a unique filename
    const filename = `${generateId()}${getFileExtension(sourceUri)}`;
    const destination = resolveRecitationPath(filename);

    // Copy the file to the uploads directory
    await FileSystem.copyAsync({from: sourceUri, to: destination});

    // Check file size (warn but don't block)
    try {
      const fileInfo = await FileSystem.getInfoAsync(destination, {size: true});
      if (
        fileInfo.exists &&
        fileInfo.size &&
        fileInfo.size > LARGE_FILE_WARNING_BYTES
      ) {
        console.warn(
          `Large file imported: ${originalFilename} (${(fileInfo.size / (1024 * 1024)).toFixed(1)}MB). ` +
            'Consider compressing audio files over 100MB.',
        );
      }
    } catch (error) {
      console.warn('Could not check file size:', error);
    }

    // Create the recitation record
    const recitation: UploadedRecitation = {
      id: generateId(),
      filePath: filename,
      originalFilename,
      duration: null,
      dateAdded: Date.now(),
      type: null,
      surahNumber: null,
      startVerse: null,
      endVerse: null,
      title: null,
      category: null,
      reciterId: null,
      customReciterId: null,
      isPersonal: false,
      rewayah: null,
    };

    // Insert into database
    await uploadsDatabaseService.insertRecitation(recitation);

    return recitation;
  }

  async importFiles(
    files: Array<{uri: string; name: string}>,
  ): Promise<UploadedRecitation[]> {
    const results: UploadedRecitation[] = [];

    for (const file of files) {
      try {
        const recitation = await this.importFile(file.uri, file.name);
        results.push(recitation);
      } catch (error) {
        console.error(`Failed to import file "${file.name}":`, error);
      }
    }

    return results;
  }

  // ─── Tagging ────────────────────────────────────────────────────────

  async updateTags(
    id: string,
    tags: Partial<UploadedRecitation>,
  ): Promise<void> {
    await this.initialize();
    await uploadsDatabaseService.updateTags(id, tags);
  }

  // ─── Deletion ──────────────────────────────────────────────────────

  async deleteRecitation(id: string): Promise<void> {
    await this.initialize();

    // Get the recitation to find the file path
    const recitation = await uploadsDatabaseService.getById(id);

    if (recitation) {
      // Delete the file from disk
      await FileSystem.deleteAsync(resolveRecitationPath(recitation.filePath), {
        idempotent: true,
      });
    }

    // Delete the database record
    await uploadsDatabaseService.deleteRecitation(id);
  }

  // ─── Query Methods ─────────────────────────────────────────────────

  async getAll(): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getAll();
  }

  async getUntagged(): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getUntagged();
  }

  async getBySurah(surahNumber: number): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getBySurah(surahNumber);
  }

  async getByReciter(reciterId: string): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getByReciter(reciterId);
  }

  async getByCustomReciter(
    customReciterId: string,
  ): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getByCustomReciter(customReciterId);
  }

  async getOther(): Promise<UploadedRecitation[]> {
    await this.initialize();
    return await uploadsDatabaseService.getOther();
  }

  async getTotalCount(): Promise<number> {
    await this.initialize();
    return await uploadsDatabaseService.getTotalCount();
  }

  // ─── Custom Reciters ───────────────────────────────────────────────

  async createCustomReciter(name: string): Promise<CustomReciter> {
    await this.initialize();

    const reciter: CustomReciter = {
      id: generateId(),
      name,
      imageUri: null,
      createdAt: Date.now(),
    };

    await uploadsDatabaseService.insertCustomReciter(reciter);

    return reciter;
  }

  async getCustomReciters(): Promise<CustomReciter[]> {
    await this.initialize();
    return await uploadsDatabaseService.getAllCustomReciters();
  }

  async deleteCustomReciter(id: string): Promise<void> {
    await this.initialize();
    await uploadsDatabaseService.deleteCustomReciter(id);
  }

  // ─── Orphan Cleanup ────────────────────────────────────────────────

  async maybeRunOrphanCleanup(): Promise<void> {
    try {
      const lastCheckStr = await AsyncStorage.getItem(ORPHAN_CHECK_KEY);
      const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
      const now = Date.now();

      if (now - lastCheck > ORPHAN_CHECK_INTERVAL) {
        await AsyncStorage.setItem(ORPHAN_CHECK_KEY, now.toString());
        // Run cleanup after a delay to not block startup
        setTimeout(() => this.cleanupOrphanFiles(), 3000);
      }
    } catch (error) {
      console.error('Error checking orphan cleanup schedule:', error);
    }
  }

  private async cleanupOrphanFiles(): Promise<void> {
    try {
      await this.initialize();
      const uploadsDir = `${FileSystem.documentDirectory}${UPLOADS_DIR}`;
      const dirInfo = await FileSystem.getInfoAsync(uploadsDir);
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(uploadsDir);
      const recitations = await uploadsDatabaseService.getAll();
      const knownPaths = new Set(recitations.map(r => r.filePath));

      for (const file of files) {
        if (!knownPaths.has(file)) {
          await FileSystem.deleteAsync(`${uploadsDir}${file}`, {
            idempotent: true,
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up orphan files:', error);
    }
  }

  // ─── Storage Size ──────────────────────────────────────────────────

  async getTotalStorageSize(): Promise<number> {
    await this.initialize();

    const recitations = await uploadsDatabaseService.getAll();
    let totalBytes = 0;

    for (const recitation of recitations) {
      try {
        const filePath = resolveRecitationPath(recitation.filePath);
        const fileInfo = await FileSystem.getInfoAsync(filePath, {size: true});

        if (fileInfo.exists && fileInfo.size) {
          totalBytes += fileInfo.size;
        }
      } catch (error) {
        // Skip files that can't be read
        console.warn(
          `Could not get size for file "${recitation.filePath}":`,
          error,
        );
      }
    }

    return totalBytes;
  }
}

// Export singleton instance
export const uploadsService = new UploadsService();
