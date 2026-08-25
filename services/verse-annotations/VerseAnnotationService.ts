import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import {qfSyncDatabaseService} from '@/services/sync/qfSyncDatabaseService';
import type {
  AnnotationOwnerScope,
  HighlightColor,
} from '@/types/verse-annotations';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {useQfSyncStore} from '@/store/qfSyncStore';

function currentRewayah(): string {
  return useMushafSettingsStore.getState().rewayah;
}

function activeAccountId(): string | null {
  return useQfSyncStore.getState().activeAccountId;
}

function ownerScope(accountId: string | null): AnnotationOwnerScope {
  return accountId ? `qf:${accountId}` : 'guest';
}

function requestSync(accountId: string | null): void {
  if (accountId) useQfSyncStore.getState().requestSync();
}

class VerseAnnotationService {
  async initialize(): Promise<void> {
    await verseAnnotationDatabaseService.initialize();
  }

  async toggleBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ): Promise<boolean> {
    const accountId = activeAccountId();
    const scope = ownerScope(accountId);
    const exists =
      await verseAnnotationDatabaseService.isBookmarkedInOwnerScope(
        scope,
        verseKey,
      );
    if (exists) {
      if (accountId) {
        await qfSyncDatabaseService.removeBookmark({accountId, verseKey});
      } else {
        await verseAnnotationDatabaseService.removeBookmark(verseKey);
      }
      requestSync(accountId);
      return false;
    }
    const resolvedRewayah = rewayahId ?? currentRewayah();
    if (accountId) {
      await qfSyncDatabaseService.addBookmark({
        accountId,
        verseKey,
        surahNumber,
        ayahNumber,
        rewayahId: resolvedRewayah,
      });
    } else {
      await verseAnnotationDatabaseService.addBookmark(
        verseKey,
        surahNumber,
        ayahNumber,
        resolvedRewayah,
      );
    }
    requestSync(accountId);
    return true;
  }

  async getBookmarksBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getBookmarksBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async getAllBookmarks() {
    return verseAnnotationDatabaseService.getAllBookmarksInOwnerScope(
      ownerScope(activeAccountId()),
    );
  }

  async isBookmarked(verseKey: string) {
    return verseAnnotationDatabaseService.isBookmarkedInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ) {
    const accountId = activeAccountId();
    const resolvedRewayah = rewayahId ?? currentRewayah();
    const bookmark = accountId
      ? await qfSyncDatabaseService.addBookmark({
          accountId,
          verseKey,
          surahNumber,
          ayahNumber,
          rewayahId: resolvedRewayah,
        })
      : await verseAnnotationDatabaseService.addBookmark(
          verseKey,
          surahNumber,
          ayahNumber,
          resolvedRewayah,
        );
    requestSync(accountId);
    return bookmark;
  }

  async removeBookmark(verseKey: string): Promise<void> {
    const accountId = activeAccountId();
    if (accountId) {
      await qfSyncDatabaseService.removeBookmark({accountId, verseKey});
    } else {
      await verseAnnotationDatabaseService.removeBookmark(verseKey);
    }
    requestSync(accountId);
  }

  async addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ) {
    const accountId = activeAccountId();
    const resolvedRewayah = rewayahId ?? currentRewayah();
    const note = accountId
      ? await qfSyncDatabaseService.addNote({
          accountId,
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeys,
          rewayahId: resolvedRewayah,
        })
      : await verseAnnotationDatabaseService.addNote(
          verseKey,
          surahNumber,
          ayahNumber,
          content,
          verseKeys,
          resolvedRewayah,
        );
    requestSync(accountId);
    return note;
  }

  async updateNote(noteId: string, content: string): Promise<void> {
    const accountId = activeAccountId();
    if (accountId) {
      await qfSyncDatabaseService.updateNote({accountId, noteId, content});
    } else {
      await verseAnnotationDatabaseService.updateNote(noteId, content);
    }
    requestSync(accountId);
  }

  async getNoteById(noteId: string) {
    return verseAnnotationDatabaseService.getNoteByIdInOwnerScope(
      ownerScope(activeAccountId()),
      noteId,
    );
  }

  async getNotesForVerse(verseKey: string) {
    return verseAnnotationDatabaseService.getNotesForVerseInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async deleteNoteById(noteId: string): Promise<void> {
    const accountId = activeAccountId();
    if (accountId) {
      await qfSyncDatabaseService.deleteNote({accountId, noteId});
    } else {
      await verseAnnotationDatabaseService.deleteNoteById(noteId);
    }
    requestSync(accountId);
  }

  async getNotesCountForVerse(verseKey: string) {
    return verseAnnotationDatabaseService.getNotesCountForVerseInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async getAllNotes() {
    return verseAnnotationDatabaseService.getAllNotesInOwnerScope(
      ownerScope(activeAccountId()),
    );
  }

  async getNotesBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getNotesBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return verseAnnotationDatabaseService.upsertHighlightForOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId ?? currentRewayah(),
    );
  }

  async removeHighlight(verseKey: string): Promise<void> {
    await verseAnnotationDatabaseService.removeHighlightInOwnerScope(
      ownerScope(activeAccountId()),
      verseKey,
    );
  }

  async getHighlightsBySurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getHighlightsBySurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async getAnnotationsForSurah(surahNumber: number) {
    return verseAnnotationDatabaseService.getAnnotationsForSurahInOwnerScope(
      ownerScope(activeAccountId()),
      surahNumber,
    );
  }

  async setHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return this.upsertHighlight(
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId,
    );
  }
}

export const verseAnnotationService = new VerseAnnotationService();
