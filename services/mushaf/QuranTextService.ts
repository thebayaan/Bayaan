import {digitalKhattDataService, DKLine} from './DigitalKhattDataService';

export const enum SpaceType {
  Simple = 1,
  Aya,
}

export interface WordInfo {
  startIndex: number;
  endIndex: number;
  text: string;
  baseText: string;
}

export interface LineTextInfo {
  ayaSpaceIndexes: number[];
  simpleSpaceIndexes: number[];
  spaces: Map<number, SpaceType>;
  wordInfos: WordInfo[];
}

// Reference coordinate system constants (from DigitalKhatt reference)
export const PAGE_WIDTH = 17000;
export const INTERLINE = 1800;
export const TOP = 200;
export const MARGIN = 400;
export const FONTSIZE = 1000;
export const SPACEWIDTH = 100;

const dualJoinLetters = 'بتثجحخسشصضطظعغفقكلمنهيئى';
const rightNoJoinLetters = 'ادذرزوؤأٱإءة';

class QuranTextService {
  private bases = new Set<number>();
  private lineTextCache: Map<string, string> = new Map();
  private lineTextInfoCache: Map<string, LineTextInfo> = new Map();

  // Line width ratios for special pages (pages with shorter lines)
  private madinaLineWidths = new Map<string, number>();

  public readonly dualJoinLetters = dualJoinLetters;
  public readonly rightNoJoinLetters = rightNoJoinLetters;

  constructor() {
    this.initBases();
    this.initLineWidths();
  }

  private initBases(): void {
    for (let i = 0; i < dualJoinLetters.length; i++) {
      this.bases.add(dualJoinLetters.charCodeAt(i));
    }
    for (let i = 0; i < rightNoJoinLetters.length; i++) {
      this.bases.add(rightNoJoinLetters.charCodeAt(i));
    }
  }

  private initLineWidths(): void {
    // Special line widths for pages with shorter lines
    // Key format: "pageNumber:lineNumber" (1-indexed page, 1-indexed line)
    // Reference uses 0-indexed pageIndex; we use 1-indexed pageNumber

    // Pages 1-2 (Al-Fatiha, Al-Baqarah opening) have centered shorter lines
    const ratio = 0.9;
    for (let pageNumber = 1; pageNumber <= 2; pageNumber++) {
      this.madinaLineWidths.set(`${pageNumber}:2`, ratio * 0.5);
      this.madinaLineWidths.set(`${pageNumber}:3`, ratio * 0.7);
      this.madinaLineWidths.set(`${pageNumber}:4`, ratio * 0.9);
      this.madinaLineWidths.set(`${pageNumber}:5`, ratio);
      this.madinaLineWidths.set(`${pageNumber}:6`, ratio * 0.9);
      this.madinaLineWidths.set(`${pageNumber}:7`, ratio * 0.7);
      this.madinaLineWidths.set(`${pageNumber}:8`, ratio * 0.4);
    }

    // Last pages with shorter lines
    this.madinaLineWidths.set('600:9', 0.84);
    this.madinaLineWidths.set('602:5', 0.61);
    this.madinaLineWidths.set('602:15', 0.59);
    this.madinaLineWidths.set('603:10', 0.68);
    this.madinaLineWidths.set('604:4', 0.836);
    this.madinaLineWidths.set('604:9', 0.836);
    this.madinaLineWidths.set('604:14', 0.717);
    this.madinaLineWidths.set('604:15', 0.54);
  }

  /**
   * Get the full text of a line by joining word texts with spaces
   */
  getLineText(pageNumber: number, lineIndex: number): string {
    const key = `${pageNumber}:${lineIndex}`;
    const cached = this.lineTextCache.get(key);
    if (cached !== undefined) return cached;

    const lines = digitalKhattDataService.getPageLines(pageNumber);
    if (lineIndex >= lines.length) return '';

    const line = lines[lineIndex];
    const text = digitalKhattDataService.getLineText(line);
    this.lineTextCache.set(key, text);
    return text;
  }

  /**
   * Get line metadata: lineType (0=ayah, 1=surah_name, 2=basmallah), lineWidthRatio
   */
  getLineInfo(
    pageNumber: number,
    lineIndex: number,
  ): {lineType: number; lineWidthRatio: number; isCentered: boolean} {
    const lines = digitalKhattDataService.getPageLines(pageNumber);
    if (lineIndex >= lines.length) {
      return {lineType: 0, lineWidthRatio: 1, isCentered: false};
    }

    const line = lines[lineIndex];
    let lineType = 0;
    if (line.line_type === 'surah_name') lineType = 1;
    else if (line.line_type === 'basmallah') lineType = 2;

    // Line number is 1-indexed in the DB
    const lineWidthRatio =
      this.madinaLineWidths.get(`${pageNumber}:${line.line_number}`) || 1;

    return {
      lineType,
      lineWidthRatio,
      isCentered: line.is_centered === 1,
    };
  }

  /**
   * Analyze text of a line: find word boundaries, classify spaces
   */
  analyzeText(pageNumber: number, lineIndex: number): LineTextInfo {
    const key = `${pageNumber}:${lineIndex}`;
    const cached = this.lineTextInfoCache.get(key);
    if (cached) return cached;

    const lineText = this.getLineText(pageNumber, lineIndex);

    const lineTextInfo: LineTextInfo = {
      ayaSpaceIndexes: [],
      simpleSpaceIndexes: [],
      wordInfos: [],
      spaces: new Map(),
    };

    if (!lineText) {
      this.lineTextInfoCache.set(key, lineTextInfo);
      return lineTextInfo;
    }

    let currentWord: WordInfo = {
      text: '',
      startIndex: 0,
      endIndex: -1,
      baseText: '',
    };
    lineTextInfo.wordInfos.push(currentWord);

    for (let i = 0; i < lineText.length; i++) {
      const char = lineText.charAt(i);
      if (char === ' ') {
        // Classify space type
        // Aya space: before verse end marker ۝ (U+06DD) or after Arabic-Indic digit
        const prevCharCode = i > 0 ? lineText.charCodeAt(i - 1) : 0;
        const nextCharCode =
          i < lineText.length - 1 ? lineText.charCodeAt(i + 1) : 0;

        if (
          (prevCharCode >= 0x0660 && prevCharCode <= 0x0669) ||
          nextCharCode === 0x06dd
        ) {
          lineTextInfo.ayaSpaceIndexes.push(i);
          lineTextInfo.spaces.set(i, SpaceType.Aya);
        } else {
          lineTextInfo.simpleSpaceIndexes.push(i);
          lineTextInfo.spaces.set(i, SpaceType.Simple);
        }

        currentWord = {text: '', startIndex: i + 1, endIndex: i, baseText: ''};
        lineTextInfo.wordInfos.push(currentWord);
      } else {
        currentWord.text += char;
        if (this.bases.has(char.charCodeAt(0))) {
          currentWord.baseText += char;
        }
        currentWord.endIndex = i;
      }
    }

    this.lineTextInfoCache.set(key, lineTextInfo);
    return lineTextInfo;
  }

  /**
   * Check if the character at the given index is the last base letter in the text
   */
  isLastBase(text: string, index: number): boolean {
    for (let charIndex = index + 1; charIndex < text.length; charIndex++) {
      if (this.bases.has(text.charCodeAt(charIndex))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Count base letters in text
   */
  nbBases(text: string): number {
    let nb = 0;
    for (let charIndex = 0; charIndex < text.length; charIndex++) {
      if (this.bases.has(text.charCodeAt(charIndex))) {
        nb++;
      }
    }
    return nb;
  }
}

export const quranTextService = new QuranTextService();
