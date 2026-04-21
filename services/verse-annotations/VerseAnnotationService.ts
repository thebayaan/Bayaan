import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import type {HighlightColor} from '@/types/verse-annotations';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';

function currentRewayah(): string {
  return useMushafSettingsStore.getState().rewayah;
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
    const exists = await verseAnnotationDatabaseService.isBookmarked(verseKey);
    if (exists) {
      await verseAnnotationDatabaseService.removeBookmark(verseKey);
      return false;
    }
    await verseAnnotationDatabaseService.addBookmark(
      verseKey,
      surahNumber,
      ayahNumber,
      rewayahId ?? currentRewayah(),
    );
    return true;
  }

  getBookmarksBySurah = verseAnnotationDatabaseService.getBookmarksBySurah.bind(
    verseAnnotationDatabaseService,
  );
  getAllBookmarks = verseAnnotationDatabaseService.getAllBookmarks.bind(
    verseAnnotationDatabaseService,
  );
  isBookmarked = verseAnnotationDatabaseService.isBookmarked.bind(
    verseAnnotationDatabaseService,
  );
  addBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    rewayahId?: string,
  ) {
    return verseAnnotationDatabaseService.addBookmark(
      verseKey,
      surahNumber,
      ayahNumber,
      rewayahId ?? currentRewayah(),
    );
  }

  addNote(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    content: string,
    verseKeys?: string[],
    rewayahId?: string,
  ) {
    return verseAnnotationDatabaseService.addNote(
      verseKey,
      surahNumber,
      ayahNumber,
      content,
      verseKeys,
      rewayahId ?? currentRewayah(),
    );
  }
  updateNote = verseAnnotationDatabaseService.updateNote.bind(
    verseAnnotationDatabaseService,
  );
  getNoteById = verseAnnotationDatabaseService.getNoteById.bind(
    verseAnnotationDatabaseService,
  );
  getNotesForVerse = verseAnnotationDatabaseService.getNotesForVerse.bind(
    verseAnnotationDatabaseService,
  );
  deleteNoteById = verseAnnotationDatabaseService.deleteNoteById.bind(
    verseAnnotationDatabaseService,
  );
  getNotesCountForVerse =
    verseAnnotationDatabaseService.getNotesCountForVerse.bind(
      verseAnnotationDatabaseService,
    );
  getAllNotes = verseAnnotationDatabaseService.getAllNotes.bind(
    verseAnnotationDatabaseService,
  );
  getNotesBySurah = verseAnnotationDatabaseService.getNotesBySurah.bind(
    verseAnnotationDatabaseService,
  );
  removeBookmark = verseAnnotationDatabaseService.removeBookmark.bind(
    verseAnnotationDatabaseService,
  );

  upsertHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return verseAnnotationDatabaseService.upsertHighlight(
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId ?? currentRewayah(),
    );
  }
  removeHighlight = verseAnnotationDatabaseService.removeHighlight.bind(
    verseAnnotationDatabaseService,
  );
  getHighlightsBySurah =
    verseAnnotationDatabaseService.getHighlightsBySurah.bind(
      verseAnnotationDatabaseService,
    );

  getAnnotationsForSurah =
    verseAnnotationDatabaseService.getAnnotationsForSurah.bind(
      verseAnnotationDatabaseService,
    );

  async setHighlight(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
    color: HighlightColor,
    rewayahId?: string,
  ) {
    return verseAnnotationDatabaseService.upsertHighlight(
      verseKey,
      surahNumber,
      ayahNumber,
      color,
      rewayahId ?? currentRewayah(),
    );
  }
}

export const verseAnnotationService = new VerseAnnotationService();
