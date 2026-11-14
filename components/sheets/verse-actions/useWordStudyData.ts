// @ai-generated
/**
 * The data Word Study shows (WordStudyContent):
 *  - useWordStudyData(parts): each part's Hafs DigitalKhatt words,
 *    word-by-word words and i'rab, the word sequence the screen steps
 *    through, and the mushaf text of every word (what i'rab references,
 *    gharib quotes and the rasm Mushaf row show);
 *  - useVerseWordStudy(verseKey): the Arabic meanings (gharib) and rasm of
 *    the current word's verse, loaded beside the rest so they never hold the
 *    screen up (their sections stay hidden until they land);
 *  - useIrabBooks(verseKeys, enabled): the classical i'rab books' passages,
 *    loaded the first time the books tab opens.
 *
 * Everything is keyed by Hafs verse and word-by-word position (the i'rab
 * numbering); a word's DigitalKhatt slots are only the readings' key
 * (wordStudy.ts).
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {irabDataService} from '@/services/irab/IrabDataService';
import {
  quotableWord,
  type IrabBookPassages,
  type WordIrab,
} from '@/services/irab/irabFormat';
import {wbwDataService} from '@/services/wbw/WBWDataService';
import {wordStudyDataService} from '@/services/wordStudy/WordStudyDataService';
import type {VerseWordStudy} from '@/services/wordStudy/wordStudyFormat';
import type {WordStudyPart} from './verseUnitScreens';
import {buildWordSequence, type PartWords, type StudyWord} from './wordStudy';

/** One part of the selection, loaded. */
export interface PartData {
  part: WordStudyPart;
  words: PartWords;
  /** The verse's i'rab, by word; null when it failed to load. */
  irab: readonly WordIrab[] | null;
  /**
   * The mushaf's own (DigitalKhatt) text of every word of the verse, by
   * word-by-word position, waqf marks out: never the word-by-word text,
   * which is damaged in some words.
   */
  wordText: ReadonlyMap<number, string>;
}

export type WordStudyData =
  | {status: 'loading'}
  | {status: 'error'; retry: () => void}
  | {
      status: 'ready';
      parts: readonly PartData[];
      /** Every word of the selection, in reading order (buildWordSequence). */
      sequence: readonly StudyWord[];
    };

interface Loaded {
  parts: PartData[];
  sequence: StudyWord[];
}

/** What a part is, as text: the same parts give the same signature. */
export function partsSignature(parts: readonly WordStudyPart[]): string {
  return parts
    .map(p =>
      [
        p.verseKey,
        p.caption,
        p.wordRange ? `${p.wordRange.first}-${p.wordRange.last}` : '',
      ].join('|'),
    )
    .join(',');
}

/** The quotable mushaf text of every word of a verse, by position. */
function verseWordTexts(
  verseKey: string,
  words: PartWords,
): Map<number, string> {
  const whole = buildWordSequence(
    [{verseKey, caption: 'none'}],
    new Map([[verseKey, words]]),
  );
  const texts = new Map<number, string>();
  for (const word of whole) {
    const text = quotableWord(word.text);
    if (text) texts.set(word.position, text);
  }
  return texts;
}

async function loadParts(
  parts: readonly WordStudyPart[],
  retry: boolean, // @ai: Try again reloads instead of rethrowing the old error
): Promise<Loaded> {
  // getVerseWords returns [] until the word-by-word database is open.
  await wbwDataService.initialize();
  if (!digitalKhattDataService.isRewayahReady('hafs')) {
    await (retry
      ? digitalKhattDataService.ensureRewayahLoaded('hafs', {retry: true})
      : digitalKhattDataService.ensureRewayahLoaded('hafs'));
  }
  // Read the Hafs words now, while they are certainly in memory.
  const dkWords = parts.map(part =>
    digitalKhattDataService.tryGetVerseWords(part.verseKey, 'hafs'),
  );
  const loaded = await Promise.all(
    parts.map(async (part, i): Promise<PartData> => {
      const dk = dkWords[i];
      if (!dk) throw new Error(`no Hafs words for ${part.verseKey}`);
      const [wbw, irab] = await Promise.all([
        wbwDataService.getVerseWords(part.verseKey),
        irabDataService.getVerse(part.verseKey).catch((error: unknown) => {
          // The i'rab section says so; the other sections still work.
          console.warn('[WordStudy] the irab failed to load:', error);
          return null;
        }),
      ]);
      const words: PartWords = {dk, wbw};
      return {
        part,
        words,
        irab,
        wordText: verseWordTexts(part.verseKey, words),
      };
    }),
  );
  const sequence = buildWordSequence(
    parts,
    new Map(loaded.map(p => [p.part.verseKey, p.words])),
  );
  return {parts: loaded, sequence};
}

type LoadResult =
  | {signature: string; attempt: number; loaded: Loaded}
  | {signature: string; attempt: number; failed: true};

/**
 * The words of the selection's parts. Loads every part in parallel, after
 * the word-by-word database is open and the Hafs words are in memory; an
 * i'rab failure gives that part `irab: null`, any other failure gives
 * 'error' with a retry. Reloads only when the parts change in content.
 */
export function useWordStudyData(
  parts: readonly WordStudyPart[],
): WordStudyData {
  const signature = partsSignature(parts);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadParts(partsRef.current, attempt > 0).then(
      loaded => {
        if (!cancelled) setResult({signature, attempt, loaded});
      },
      (error: unknown) => {
        console.warn('[WordStudy] words failed to load:', error);
        if (!cancelled) setResult({signature, attempt, failed: true});
      },
    );
    return () => {
      cancelled = true;
    };
  }, [signature, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  return useMemo<WordStudyData>(() => {
    // A result of other parts, or of an earlier attempt, is not shown.
    if (
      !result ||
      result.signature !== signature ||
      result.attempt !== attempt
    ) {
      return {status: 'loading'};
    }
    if ('failed' in result) return {status: 'error', retry};
    return {
      status: 'ready',
      parts: result.loaded.parts,
      sequence: result.loaded.sequence,
    };
  }, [result, signature, attempt, retry]);
}

/**
 * The gharib entries and rasm units of Hafs verse `verseKey` (null while
 * they load, and for another verse until its own arrive). The service never
 * rejects; a kind that is missing or failed reads as empty, which hides its
 * section.
 */
export function useVerseWordStudy(
  verseKey: string | null,
): VerseWordStudy | null {
  const [study, setStudy] = useState<VerseWordStudy | null>(null);
  useEffect(() => {
    if (!verseKey) return;
    let cancelled = false;
    wordStudyDataService.getVerse(verseKey).then(verse => {
      if (!cancelled) setStudy(verse);
    });
    return () => {
      cancelled = true;
    };
  }, [verseKey]);
  return study && study.verseKey === verseKey ? study : null;
}

export type IrabBooksState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'error'; retry: () => void}
  | {status: 'ready'; books: ReadonlyMap<string, IrabBookPassages[]>};

/**
 * The i'rab books' passages of each verse, loaded once `enabled` (the books
 * tab has been opened) and again when the verses change.
 */
export function useIrabBooks(
  verseKeys: readonly string[],
  enabled: boolean,
): IrabBooksState {
  const signature = verseKeys.join(',');
  const keysRef = useRef(verseKeys);
  keysRef.current = verseKeys;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<
    | {
        signature: string;
        attempt: number;
        books: ReadonlyMap<string, IrabBookPassages[]>;
      }
    | {signature: string; attempt: number; failed: true}
    | null
  >(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const keys = keysRef.current;
    Promise.all(keys.map(key => irabDataService.getBooks(key))).then(
      lists => {
        if (cancelled) return;
        setResult({
          signature,
          attempt,
          books: new Map(keys.map((key, i) => [key, lists[i]])),
        });
      },
      (error: unknown) => {
        console.warn('[WordStudy] the irab books failed to load:', error);
        if (!cancelled) setResult({signature, attempt, failed: true});
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, signature, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);

  return useMemo<IrabBooksState>(() => {
    if (!enabled) return {status: 'idle'};
    if (
      !result ||
      result.signature !== signature ||
      result.attempt !== attempt
    ) {
      return {status: 'loading'};
    }
    if ('failed' in result) return {status: 'error', retry};
    return {status: 'ready', books: result.books};
  }, [enabled, result, signature, attempt, retry]);
}
