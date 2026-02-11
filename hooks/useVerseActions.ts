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
        const wasAdded = await verseAnnotationService.toggleBookmark(
          verseKey,
          surahNumber,
          ayahNumber,
        );
        const store = useVerseAnnotationsStore.getState();
        if (wasAdded) {
          store.addBookmark(verseKey);
        } else {
          store.removeBookmark(verseKey);
        }
      },

      upsertNote: async (
        verseKey: string,
        surahNumber: number,
        ayahNumber: number,
        content: string,
      ) => {
        await verseAnnotationService.upsertNote(
          verseKey,
          surahNumber,
          ayahNumber,
          content,
        );
        useVerseAnnotationsStore.getState().addNote(verseKey);
      },

      deleteNote: async (verseKey: string) => {
        await verseAnnotationService.deleteNote(verseKey);
        useVerseAnnotationsStore.getState().removeNote(verseKey);
      },

      setHighlight: async (
        verseKey: string,
        surahNumber: number,
        ayahNumber: number,
        color: HighlightColor,
      ) => {
        await verseAnnotationService.setHighlight(
          verseKey,
          surahNumber,
          ayahNumber,
          color,
        );
        useVerseAnnotationsStore.getState().setHighlight(verseKey, color);
      },

      removeHighlight: async (verseKey: string) => {
        await verseAnnotationService.removeHighlight(verseKey);
        useVerseAnnotationsStore.getState().removeHighlight(verseKey);
      },
    }),
    [],
  );
}
