import {verseAnnotationDatabaseService} from '@/services/database/VerseAnnotationDatabaseService';
import type {HighlightColor} from '@/types/verse-annotations';

class VerseAnnotationService {
  async initialize(): Promise<void> {
    await verseAnnotationDatabaseService.initialize();
  }

  async toggleBookmark(
    verseKey: string,
    surahNumber: number,
    ayahNumber: number,
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

  addNote = verseAnnotationDatabaseService.addNote.bind(
    verseAnnotationDatabaseService,
  );
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

  upsertHighlight = verseAnnotationDatabaseService.upsertHighlight.bind(
    verseAnnotationDatabaseService,
  );
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
  ) {
    return verseAnnotationDatabaseService.upsertHighlight(
      verseKey,
      surahNumber,
      ayahNumber,
      color,
    );
  }
}

export const verseAnnotationService = new VerseAnnotationService();
