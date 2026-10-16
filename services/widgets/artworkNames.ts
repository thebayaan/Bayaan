// services/widgets/artworkNames.ts
// File names in the shared artwork dir. No imports, so build scripts can use it.
// Download URLs live in surahArtwork.ts.

export function surahArtworkFileName(surahId: number): string {
  return `surah-${surahId}.jpg`;
}
