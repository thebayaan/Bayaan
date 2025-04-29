import {create} from 'zustand';

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
  isLoading: boolean;
  error: string | null;
  setTajweedData: (data: TajweedData) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTajweedStore = create<TajweedStore>(set => ({
  tajweedData: null,
  isLoading: false,
  error: null,
  setTajweedData: data => set({tajweedData: data}),
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
