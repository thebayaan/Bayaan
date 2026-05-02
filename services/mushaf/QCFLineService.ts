import type {QCFWord} from './QCFDataService';
import {digitalKhattDataService} from './DigitalKhattDataService';
import {
  alignWordTajweed,
  detectWordTafkhim,
} from './TajweedAlignmentService';
import type {IndexedTajweedData} from '@/utils/tajweedLoader';

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

function findDKWordText(location: string): string | null {
  const [surah, ayah, word] = location.split(':');
  const verseKey = `${surah}:${ayah}`;
  const wordPosition = parseInt(word, 10);
  if (Number.isNaN(wordPosition)) return null;

  const dkWord = digitalKhattDataService
    .getVerseWords(verseKey)
    .find(entry => entry.wordPositionInVerse === wordPosition);

  return dkWord?.text ?? null;
}

function dominantRule(ruleMap: Map<number, string>): string | null {
  const counts = new Map<string, number>();
  for (const rule of ruleMap.values()) {
    counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = -1;
  for (const [rule, count] of counts) {
    if (count > winnerCount) {
      winner = rule;
      winnerCount = count;
    }
  }

  return winner;
}

function projectWordRulesToQCF(
  code: string,
  wordRules: Map<number, string>,
  dkWordText: string,
): Map<number, string> | null {
  const qcfChars = [...code].map(char => (char === ' ' ? QCF_HAIR_SPACE : char));
  const qcfSlots = qcfChars
    .map((char, index) => (char === QCF_HAIR_SPACE ? null : index))
    .filter((index): index is number => index !== null);

  if (qcfSlots.length === 0) return null;

  const projected = new Map<number, string>();
  const dkLength = Math.max([...dkWordText].length, 1);

  for (const [dkIndex, rule] of wordRules) {
    const slotIndex = Math.min(
      qcfSlots.length - 1,
      Math.floor((dkIndex * qcfSlots.length) / dkLength),
    );
    projected.set(qcfSlots[slotIndex], rule);
  }

  if (projected.size === 0 && wordRules.size > 0) {
    const rule = dominantRule(wordRules);
    if (rule) {
      projected.set(qcfSlots[0], rule);
    }
  }

  return projected.size > 0 ? projected : null;
}

export function buildQCFLineTajweedMap(
  words: QCFWord[],
  indexedTajweedData: IndexedTajweedData,
): Map<number, string> | null {
  const charToRule = new Map<number, string>();
  let charOffset = 0;

  for (const word of words) {
    const [surah, ayah, wordPositionRaw] = word.location.split(':');
    const verseKey = `${surah}:${ayah}`;
    const wordPosition = parseInt(wordPositionRaw, 10);
    const dkWordText = findDKWordText(word.location);
    const qcfLength = [...word.code.replace(/ /g, QCF_HAIR_SPACE)].length;

    if (!dkWordText || Number.isNaN(wordPosition)) {
      charOffset += qcfLength;
      continue;
    }

    const tajweedWord = indexedTajweedData[verseKey]?.find(entry => {
      const pos = parseInt(entry.location.split(':')[2], 10);
      return pos === wordPosition;
    });

    const wordRules = tajweedWord
      ? alignWordTajweed(dkWordText, tajweedWord.segments)
      : detectWordTafkhim(dkWordText);

    if (wordRules && wordRules.size > 0) {
      const projected = projectWordRulesToQCF(word.code, wordRules, dkWordText);
      if (projected) {
        for (const [localIndex, rule] of projected) {
          charToRule.set(charOffset + localIndex, rule);
        }
      }
    }

    charOffset += qcfLength;
  }

  if (charToRule.size === 0) return null;

  if (charToRule.size > 0) {
    const shifted = new Map<number, string>();
    for (const [index, rule] of charToRule) {
      shifted.set(index >= 1 ? index + 1 : index, rule);
    }
    return shifted;
  }

  return charToRule;
}
