import type {QCFWord} from './QCFDataService';

export const QCF_HAIR_SPACE = ' ';

export interface QCFLineCharMeta {
  verseKey: string;
  location: string;
  wordIndex: number;
}

export interface QCFVerseSegment {
  verseKey: string;
  startCharIndex: number;
  endCharIndex: number;
}

export interface QCFLineRenderModel {
  renderedText: string;
  charMeta: Array<QCFLineCharMeta | null>;
  verseSegments: QCFVerseSegment[];
}

function verseKeyFromLocation(location: string): string {
  const [surah, ayah] = location.split(':');
  return `${surah}:${ayah}`;
}

export function buildQCFLineRenderModel(words: QCFWord[]): QCFLineRenderModel {
  const renderedChars: string[] = [];
  const charMeta: Array<QCFLineCharMeta | null> = [];

  words.forEach((word, wordIndex) => {
    const verseKey = verseKeyFromLocation(word.location);
    for (const char of word.code) {
      renderedChars.push(char === ' ' ? QCF_HAIR_SPACE : char);
      charMeta.push({
        verseKey,
        location: word.location,
        wordIndex,
      });
    }
  });

  if (renderedChars.length > 1 && renderedChars[1] !== QCF_HAIR_SPACE) {
    renderedChars.splice(1, 0, QCF_HAIR_SPACE);
    charMeta.splice(1, 0, null);
  }

  const verseSegments: QCFVerseSegment[] = [];
  let current: QCFVerseSegment | null = null;

  for (let i = 0; i < charMeta.length; i++) {
    const meta = charMeta[i];
    if (!meta) continue;

    if (current && current.verseKey === meta.verseKey) {
      current.endCharIndex = i;
      continue;
    }

    current = {
      verseKey: meta.verseKey,
      startCharIndex: i,
      endCharIndex: i,
    };
    verseSegments.push(current);
  }

  return {
    renderedText: renderedChars.join(''),
    charMeta,
    verseSegments,
  };
}

export function findQCFVerseAtCharIndex(
  model: QCFLineRenderModel,
  charIndex: number,
): QCFVerseSegment | null {
  if (model.verseSegments.length === 0) return null;

  for (const segment of model.verseSegments) {
    if (
      charIndex >= segment.startCharIndex &&
      charIndex <= segment.endCharIndex
    ) {
      return segment;
    }
  }

  for (let offset = 1; offset < model.charMeta.length; offset++) {
    const left = charIndex - offset;
    if (left >= 0) {
      const meta = model.charMeta[left];
      if (meta) {
        return (
          model.verseSegments.find(segment => segment.verseKey === meta.verseKey) ??
          null
        );
      }
    }

    const right = charIndex + offset;
    if (right < model.charMeta.length) {
      const meta = model.charMeta[right];
      if (meta) {
        return (
          model.verseSegments.find(segment => segment.verseKey === meta.verseKey) ??
          null
        );
      }
    }
  }

  return null;
}
