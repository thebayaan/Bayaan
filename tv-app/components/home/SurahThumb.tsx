import React from 'react';
import {SurahArtwork} from '../brand/SurahArtwork';

type Props = {
  surahNumber: number;
  /** Calligraphy size in design pixels. */
  glyphSize: number;
  /** Gradient id, unique per screen. */
  id: string;
};

/**
 * A surah for small slots (Continue thumbnails, the Now playing strip):
 * the surah's card art, whose calligraphy shrinks to the slot's width and
 * leaves the printed name off below tile size. Fills its parent, which sets
 * size, radius and clipping.
 */
export function SurahThumb({
  surahNumber,
  glyphSize,
  id,
}: Props): React.ReactElement {
  return <SurahArtwork surahNumber={surahNumber} glyphSize={glyphSize} id={id} />;
}
