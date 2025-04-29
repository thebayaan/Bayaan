import {create} from 'zustand';
import {ProcessedTajweedData, IndexedTajweedData} from '@/utils/tajweedLoader';

// Interface for the structure of a word entry in the tajweed JSON data
export interface TajweedWord {
  word_index: number;
  location: string; // e.g., "1:1:1"
  text: string; // The word text with embedded <rule> tags
}

// Interface for the tajweed data file structure
export interface TajweedData {
  [key: string]: TajweedWord;
}

interface TajweedStore {
  tajweedData: TajweedData | null;
  processedTajweedData: ProcessedTajweedData | null;
  indexedTajweedData: IndexedTajweedData | null;
  isLoading: boolean;
  error: string | null;
  setTajweedData: (data: TajweedData) => void;
  setProcessedTajweedData: (data: ProcessedTajweedData) => void;
  setIndexedTajweedData: (data: IndexedTajweedData) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTajweedStore = create<TajweedStore>(set => ({
  tajweedData: null,
  processedTajweedData: null,
  indexedTajweedData: null,
  isLoading: false,
  error: null,
  setTajweedData: data => set({tajweedData: data}),
  setProcessedTajweedData: data => set({processedTajweedData: data}),
  setIndexedTajweedData: data => set({indexedTajweedData: data}),
  setIsLoading: loading => set({isLoading: loading}),
  setError: error => set({error}),
}));

// Helper function to get tajweed data for a specific verse
export const getTajweedDataForVerse = (
  tajweedData: TajweedData | null,
  verseKey: string,
): TajweedWord[] | undefined => {
  if (!tajweedData) {
    return undefined;
  }

  // Find all words for this verse
  // verseKey format: "surah:ayah" (e.g., "1:1")
  // tajweed location format: "surah:ayah:word" (e.g., "1:1:1")
  const verseWords = Object.values(tajweedData).filter(word =>
    word.location.startsWith(verseKey + ':'),
  );

  // Sort by word_index to ensure correct order
  return verseWords.sort((a, b) => a.word_index - b.word_index);
};

// Helper function to get processed tajweed data for a specific verse
export const getProcessedTajweedDataForVerse = (
  processedTajweedData: ProcessedTajweedData | null,
  verseKey: string,
) => {
  if (!processedTajweedData) {
    return undefined;
  }

  // Find all words for this verse
  // verseKey format: "surah:ayah" (e.g., "1:1")
  // tajweed location format: "surah:ayah:word" (e.g., "1:1:1")
  const verseWords = Object.values(processedTajweedData).filter(word =>
    word.location.startsWith(verseKey + ':'),
  );

  // Sort by word_index to ensure correct order
  return verseWords.sort((a, b) => a.word_index - b.word_index);
};

// Helper function to get indexed tajweed data for a specific verse - O(1) lookup
export const getIndexedTajweedDataForVerse = (
  indexedTajweedData: IndexedTajweedData | null,
  verseKey: string,
) => {
  if (!indexedTajweedData) {
    return undefined;
  }

  // Direct lookup by verse key - O(1) operation
  return indexedTajweedData[verseKey];
};
