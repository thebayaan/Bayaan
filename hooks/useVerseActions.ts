import {useMemo} from 'react';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {HighlightColor} from '@/types/verse-annotations';

/**
 * Zero-re-render action hook for verse annotations.
 * All actions use getState() — no subscription, no re-renders.
 */
export function useVerseActions() {
  return useMemo(
    () => ({
      toggleBookmark: async (
        verseKey: string,
        surahNumber: number,
        ayahNumber: number,
      ) => {
        await verseAnnotationService.runInScope(async operation => {
          const wasAdded = await operation.toggleBookmark(
            verseKey,
            surahNumber,
            ayahNumber,
          );
          if (!operation.isCurrent()) return;
          const store = useVerseAnnotationsStore.getState();
          if (wasAdded) {
            store.addBookmark(verseKey);
          } else {
            store.removeBookmark(verseKey);
          }
        });
      },

      addNote: async (
        verseKey: string,
        surahNumber: number,
        ayahNumber: number,
        content: string,
      ) => {
        await verseAnnotationService.runInScope(async operation => {
          await operation.addNote(verseKey, surahNumber, ayahNumber, content);
          if (operation.isCurrent()) {
            useVerseAnnotationsStore.getState().addNote(verseKey);
          }
        });
      },

      deleteNoteById: async (noteId: string, verseKey: string) => {
        await verseAnnotationService.runInScope(async operation => {
          await operation.deleteNoteById(noteId);
          const remaining = await operation.getNotesCountForVerse(verseKey);
          if (operation.isCurrent() && remaining === 0) {
            useVerseAnnotationsStore.getState().removeNote(verseKey);
          }
        });
      },

      setHighlight: async (
        verseKey: string,
        surahNumber: number,
        ayahNumber: number,
        color: HighlightColor,
      ) => {
        await verseAnnotationService.runInScope(async operation => {
          await operation.upsertHighlight(
            verseKey,
            surahNumber,
            ayahNumber,
            color,
          );
          if (operation.isCurrent()) {
            useVerseAnnotationsStore.getState().setHighlight(verseKey, color);
          }
        });
      },

      removeHighlight: async (verseKey: string) => {
        await verseAnnotationService.runInScope(async operation => {
          await operation.removeHighlight(verseKey);
          if (operation.isCurrent()) {
            useVerseAnnotationsStore.getState().removeHighlight(verseKey);
          }
        });
      },
    }),
    [],
  );
}
