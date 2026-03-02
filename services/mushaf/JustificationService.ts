import {
  Skia,
  TextAlign,
  TextHeightBehavior,
  type SkParagraph,
  type SkParagraphBuilder,
  type SkTextFontFeatures,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import {
  quranTextService,
  FONTSIZE,
  SPACEWIDTH,
  type LineTextInfo,
  type WordInfo,
  type SubWordInfo,
} from './QuranTextService';

const lineParStyle = {
  textAlign: TextAlign.Left,
  textHeightBehavior: TextHeightBehavior.DisableAll,
};

// --- Exported types ---

export interface JustResultByLine {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  simpleSpacing: number;
  ayaSpacing: number;
  fontSizeRatio: number;
}

// --- Internal enums ---

const enum AppliedResult {
  NoChange,
  Positive,
  Overflow,
  Forbidden,
}

const enum StretchType {
  None = 0,
  Beh = 1,
  FinaAscendant = 2,
  OtherKashidas = 3,
  Kaf = 4,
  SecondKashidaNotSameSubWord = 5,
  SecondKashidaSameSubWord = 6,
}

// --- Internal types ---

interface JustInfo {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  desiredWidth: number;
  textLineWidth: number;
  layoutResults: LayoutResult[];
}

interface LayoutResult {
  parWidth: number;
  appliedKashidas: Map<
    StretchType,
    [subWordIndex: number, characterIndexInSubWord: number]
  >;
}

interface AppliedFeature {
  feature: SkTextFontFeatures;
  calcNewValue?: (prev: number | undefined, curr: number) => number;
}

interface SubWordsMatch {
  subWordIndexes: number[];
  matches: RegExpMatchArray[][];
}

// --- Character sets (from upstream) ---

const dualJoinLetters = quranTextService.dualJoinLetters;
const rightNoJoinLetters = quranTextService.rightNoJoinLetters;
const finalAscendant = 'آادذٱأإكلهة';

// --- JustService class ---

export class JustService {
  private lineText: string;
  private textStyle: SkTextStyle;
  private parInfiniteWidth: number;
  private lineWidth = 2000;
  private desiredWidth: number;
  private fontSize: number;
  private paraBuilder: SkParagraphBuilder;
  private fontFamily: string;

  constructor(
    private pageNumber: number,
    private lineIndex: number,
    private lineTextInfo: LineTextInfo,
    private fontMgr: SkTypefaceFontProvider,
    private fontSizeLineWidthRatio: number,
    private lineWidthRatio: number,
    pParBuilder?: SkParagraphBuilder,
    fontFamily: string = 'DigitalKhatt',
  ) {
    this.fontFamily = fontFamily;
    this.desiredWidth = lineWidthRatio * this.lineWidth;
    this.lineText = quranTextService.getLineText(pageNumber, lineIndex);
    this.parInfiniteWidth = 1.5 * this.desiredWidth;
    this.fontSize = this.fontSizeLineWidthRatio * this.lineWidth;

    this.textStyle = {
      fontFamilies: [fontFamily],
      fontSize: this.fontSize,
    };

    if (pParBuilder) {
      this.paraBuilder = pParBuilder;
    } else {
      this.paraBuilder = Skia.ParagraphBuilder.Make(lineParStyle, this.fontMgr);
    }
  }

  justifyLine(): JustResultByLine {
    const desiredWidth = this.desiredWidth;
    const scale = this.fontSize / FONTSIZE;
    const defaultSpaceWidth = SPACEWIDTH * scale;
    const lineTextInfo = this.lineTextInfo;

    const totalSpaces =
      lineTextInfo.ayaSpaceIndexes.length +
      lineTextInfo.simpleSpaceIndexes.length;

    let textWidthByWord = defaultSpaceWidth * totalSpaces;
    const layoutResults: LayoutResult[] = [];

    for (
      let wordIndex = 0;
      wordIndex < lineTextInfo.wordInfos.length;
      wordIndex++
    ) {
      const wordInfo = lineTextInfo.wordInfos[wordIndex];

      const paragraphBuilder = this.paraBuilder;
      paragraphBuilder.reset();
      paragraphBuilder.pushStyle(this.textStyle);
      paragraphBuilder.addText(wordInfo.text);
      const paragraph = paragraphBuilder.pop().build();
      paragraph.layout(this.parInfiniteWidth);
      const parWidth = paragraph.getLongestLine();

      textWidthByWord += parWidth;
      layoutResults.push({parWidth, appliedKashidas: new Map()});
      paragraph.dispose();
    }

    // Measure full line text width
    const getTextWidth = (): number => {
      const paragraphBuilder = this.paraBuilder;
      paragraphBuilder.reset();
      paragraphBuilder.pushStyle(this.textStyle);
      paragraphBuilder.addText(this.lineText);
      const paragraph = paragraphBuilder.pop().build();
      paragraph.layout(this.parInfiniteWidth);
      const parWidth = paragraph.getLongestLine();
      paragraph.dispose();
      return parWidth;
    };

    let currentLineWidth = getTextWidth();
    const diff = desiredWidth - currentLineWidth;

    let fontSizeRatio = 1;
    let simpleSpacing = SPACEWIDTH;
    let ayaSpacing = SPACEWIDTH;
    let justResults: JustInfo | undefined;

    if (diff > 0) {
      // Stretch
      const maxStretchBySpace = defaultSpaceWidth * 0.5;
      const maxStretchByAyaSpace = defaultSpaceWidth * 2;

      const maxStretch =
        maxStretchBySpace * lineTextInfo.simpleSpaceIndexes.length +
        maxStretchByAyaSpace * lineTextInfo.ayaSpaceIndexes.length;

      const stretch = Math.min(desiredWidth - currentLineWidth, maxStretch);
      const spaceRatio = maxStretch !== 0 ? stretch / maxStretch : 0;
      const stretchBySpace = spaceRatio * maxStretchBySpace;
      const stretchByAyaSpace = spaceRatio * maxStretchByAyaSpace;

      const simpleSpaceWidth = defaultSpaceWidth + stretchBySpace;
      let ayaSpaceWidth = defaultSpaceWidth + stretchByAyaSpace;

      currentLineWidth += stretch;

      // Kashida stretching via OpenType cv01–cv18 feature expansion
      if (desiredWidth > currentLineWidth) {
        const justInfo: JustInfo = {
          textLineWidth: currentLineWidth,
          fontFeatures: new Map(),
          layoutResults,
          desiredWidth,
        };
        this.applyExperimentalJust(justInfo);
        justResults = justInfo;
        currentLineWidth = justResults.textLineWidth;
      }

      // Distribute remaining width (or compensate overshoot) across spaces
      const addToSpace =
        (desiredWidth - currentLineWidth) / lineTextInfo.spaces.size;
      simpleSpacing = (simpleSpaceWidth + addToSpace) / scale;
      ayaSpacing = (ayaSpaceWidth + addToSpace) / scale;
    } else {
      // Shrink
      fontSizeRatio = desiredWidth / currentLineWidth;
    }

    return {
      fontFeatures: justResults?.fontFeatures || new Map(),
      simpleSpacing,
      ayaSpacing,
      fontSizeRatio,
    };
  }

  // --- Subword-based justification (ported from upstream applyExperimentalJust) ---

  private applyExperimentalJust(justInfo: JustInfo): void {
    this.applyKashidasSubWords(justInfo, StretchType.Beh, 2) ||
      this.applyAlternatesSubWords(justInfo, 'بتثكن', 2) ||
      this.applyKashidasSubWords(justInfo, StretchType.FinaAscendant, 3) ||
      this.applyKashidasSubWords(justInfo, StretchType.OtherKashidas, 2) ||
      this.applyAlternatesSubWords(justInfo, 'ىصضسشفقيئ', 2) ||
      this.applyKashidasSubWords(justInfo, StretchType.Kaf, 1) ||
      this.applyKashidasSubWords(justInfo, StretchType.Beh, 1) ||
      this.applyAlternatesSubWords(justInfo, 'بتثكن', 1) ||
      this.applyKashidasSubWords(justInfo, StretchType.FinaAscendant, 1) ||
      this.applyKashidasSubWords(justInfo, StretchType.OtherKashidas, 1) ||
      this.applyAlternatesSubWords(justInfo, 'ىصضسشفقيئ', 1) ||
      this.applyAlternatesSubWords(justInfo, 'بتثكن', 2) ||
      this.applyAlternatesSubWords(justInfo, 'ىصضسشفقيئبتثكن', 2) ||
      this.applyKashidasSubWords(justInfo, StretchType.Beh, 1) ||
      this.applyKashidasSubWords(justInfo, StretchType.FinaAscendant, 1) ||
      this.applyKashidasSubWords(justInfo, StretchType.OtherKashidas, 1) ||
      this.applyAlternatesSubWords(justInfo, 'ىصضسشفقيئبتثكن', 2) ||
      this.applyKashidasSubWords(
        justInfo,
        StretchType.SecondKashidaNotSameSubWord,
        2,
      ) ||
      this.applyKashidasSubWords(
        justInfo,
        StretchType.SecondKashidaSameSubWord,
        2,
      );
  }

  private matchSubWords(wordInfo: WordInfo, exprs: RegExp[]): SubWordsMatch {
    const result: SubWordsMatch = {subWordIndexes: [], matches: []};

    for (let subIndex = 0; subIndex < wordInfo.subwords.length; subIndex++) {
      const subWord = wordInfo.subwords[subIndex];
      const subWordMatches: RegExpMatchArray[] = [];
      result.matches.push(subWordMatches);

      for (const regExpr of exprs) {
        const matches = subWord.baseText.matchAll(regExpr);
        for (const match of matches) {
          subWordMatches.push(match);
        }
      }

      if (subWordMatches.length > 0) {
        result.subWordIndexes.push(subIndex);
      }
    }

    return result;
  }

  private applyKashidasSubWords(
    justInfo: JustInfo,
    type: StretchType,
    nbLevels: number,
  ): boolean {
    const right =
      'بتثنيئ' + 'جحخ' + 'سش' + 'صض' + 'طظ' + 'عغ' + 'فق' + 'م' + 'ه';
    const left = 'ئبتثني' + 'جحخ' + 'طظ' + 'عغ' + 'فق' + 'ةلم' + 'رز';
    const mediLeftAsendant = 'ل';

    const wordInfos = this.lineTextInfo.wordInfos;
    const matchresult: SubWordsMatch[] = [];
    const regExprs: RegExp[] = [];

    if (type === StretchType.Beh) {
      regExprs.push(new RegExp(`^.+(?<k1>[بتثنيسشصض][بتثنيم]).+$`, 'gdu'));
    } else if (type === StretchType.FinaAscendant) {
      regExprs.push(new RegExp(`^.*(?<k1>[${right}][آادذٱأإكلهة])$`, 'gdu'));
    } else if (type === StretchType.OtherKashidas) {
      regExprs.push(new RegExp(`.*(?<k1>[${right}][رز])`, 'gdu'));
      regExprs.push(
        new RegExp(
          `.*(?<k1>[${right}](?:[${mediLeftAsendant}]|[${left.replace(
            'رز',
            '',
          )}]))`,
          'gdu',
        ),
      );
    } else if (type === StretchType.Kaf) {
      regExprs.push(new RegExp(`^.*(?<k1>[ك].).*$`, 'gdu'));
    } else if (type === StretchType.SecondKashidaNotSameSubWord) {
      regExprs.push(new RegExp(`^.+(?<k1>[بتثنيسشصض][بتثنيم]).+$`, 'gdu'));
      regExprs.push(new RegExp(`^.*(?<k1>[${right}][آادذٱأإكلهة])$`, 'gdu'));
      regExprs.push(new RegExp(`.*(?<k1>[${right}][رز])`, 'gdu'));
      regExprs.push(
        new RegExp(
          `.*(?<k1>[${right}](?:[${mediLeftAsendant}]|[${left.replace(
            'رز',
            '',
          )}]))`,
          'gdu',
        ),
      );
    } else if (type === StretchType.SecondKashidaSameSubWord) {
      regExprs.push(new RegExp(`^.+(?<k1>[بتثنيسشصض][بتثنيم]).+$`, 'gdu'));
      regExprs.push(new RegExp(`(?<k1>[${right}][آادذٱأإكلهة])$`, 'gdu'));
      regExprs.push(new RegExp(`(?<k1>[${right}][رز])`, 'gdu'));
      regExprs.push(
        new RegExp(
          `(?<k1>[${right}](?:[${mediLeftAsendant}]|[${left.replace(
            'رز',
            '',
          )}]))`,
          'gdu',
        ),
      );
    }

    for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
      matchresult.push(this.matchSubWords(wordInfos[wordIndex], regExprs));
    }

    for (let level = 1; level <= nbLevels; level++) {
      for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
        const subWordsMatch = matchresult[wordIndex];
        const wordLayout = justInfo.layoutResults[wordIndex];

        const type1Applied = wordLayout.appliedKashidas.get(StretchType.Beh);
        const type2Applied = wordLayout.appliedKashidas.get(
          StretchType.FinaAscendant,
        );
        const type3Applied = wordLayout.appliedKashidas.get(
          StretchType.OtherKashidas,
        );
        const type5Applied = wordLayout.appliedKashidas.get(
          StretchType.SecondKashidaNotSameSubWord,
        );

        // Mutual exclusivity: Beh, FinaAscendant, OtherKashidas
        if (type === StretchType.Beh && (type2Applied || type3Applied))
          continue;
        if (
          type === StretchType.FinaAscendant &&
          (type1Applied || type3Applied)
        )
          continue;
        if (
          type === StretchType.OtherKashidas &&
          (type1Applied || type2Applied)
        )
          continue;

        let done = false;

        for (
          let i = subWordsMatch.subWordIndexes.length - 1;
          i >= 0 && !done;
          i--
        ) {
          const subWordIndex = subWordsMatch.subWordIndexes[i];

          for (const match of subWordsMatch.matches[subWordIndex]) {
            const kashidaGroup = (match as any)?.indices?.[1] as
              | [number, number]
              | undefined;
            if (!kashidaGroup) continue;

            const firstSubWordMatchIndex = kashidaGroup[0];
            const secondSubWordMatchIndex = firstSubWordMatchIndex + 1;

            if (type === StretchType.SecondKashidaNotSameSubWord) {
              const type123 = type1Applied || type2Applied || type3Applied;
              if (type123 && type123[0] === subWordIndex) continue;
            } else if (type === StretchType.SecondKashidaSameSubWord) {
              const type123 = type1Applied || type2Applied || type3Applied;
              if (
                type123 &&
                type123[0] === subWordIndex &&
                type123[1] === firstSubWordMatchIndex
              )
                continue;
              if (
                type5Applied &&
                type5Applied[0] === subWordIndex &&
                type5Applied[1] === firstSubWordMatchIndex
              )
                continue;
            }

            let appliedResult = AppliedResult.Forbidden;

            if (type === StretchType.Kaf) {
              appliedResult = this.applyKaf(
                justInfo,
                wordIndex,
                subWordIndex,
                firstSubWordMatchIndex,
                secondSubWordMatchIndex,
              );
            } else {
              appliedResult = this.applyKashida(
                justInfo,
                wordIndex,
                subWordIndex,
                firstSubWordMatchIndex,
                secondSubWordMatchIndex,
              );
            }

            if (appliedResult === AppliedResult.Positive) {
              wordLayout.appliedKashidas.set(type, [
                subWordIndex,
                firstSubWordMatchIndex,
              ]);
            } else if (appliedResult === AppliedResult.Overflow) {
              return true;
            } else if (appliedResult === AppliedResult.Forbidden) {
              continue;
            }

            done = true;
            break;
          }
        }
      }
    }
    return false;
  }

  private applyAlternatesSubWords(
    justInfo: JustInfo,
    chars: string,
    nbLevels: number,
  ): boolean {
    const wordInfos = this.lineTextInfo.wordInfos;
    const matchresult: SubWordsMatch[] = [];

    const patternAlt = `^.*(?<alt>[${chars}])$`;
    const regExprAlt = [new RegExp(patternAlt, 'gdu')];

    for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
      matchresult.push(this.matchSubWords(wordInfos[wordIndex], regExprAlt));
    }

    for (let level = 1; level <= nbLevels; level++) {
      for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
        const wordInfo = wordInfos[wordIndex];
        const subWordsMatch = matchresult[wordIndex];

        for (let i = subWordsMatch.subWordIndexes.length - 1; i >= 0; i--) {
          const subWordIndex = subWordsMatch.subWordIndexes[i];
          const alt = (subWordsMatch.matches[subWordIndex][0] as any)
            ?.indices?.[1] as [number, number] | undefined;
          if (!alt) continue;
          const matchIndex = alt[0];
          const indexInLine =
            wordInfo.startIndex +
            wordInfo.subwords[subWordIndex].baseIndexes[matchIndex];

          const appliedResult = this.applyAlternate(
            justInfo,
            wordIndex,
            indexInLine,
          );

          if (appliedResult === AppliedResult.Overflow) {
            return true;
          } else if (appliedResult === AppliedResult.Forbidden) {
            continue;
          } else {
            break;
          }
        }
      }
    }
    return false;
  }

  private applyKashida(
    justInfo: JustInfo,
    wordIndex: number,
    subWordIndex: number,
    firstSubWordMatchIndex: number,
    secondSubWordMatchIndex: number,
  ): AppliedResult {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[wordIndex];
    const subWordInfo = wordInfo.subwords[subWordIndex];
    const firstMatchIndex = subWordInfo.baseIndexes[firstSubWordMatchIndex];
    const secondMatchIndex = subWordInfo.baseIndexes[secondSubWordMatchIndex];
    const firstIndexInLine = wordInfo.startIndex + firstMatchIndex;
    const secondIndexInLine = wordInfo.startIndex + secondMatchIndex;

    const tempResult = new Map(justInfo.fontFeatures);

    const firstPrevFeatures = tempResult.get(firstIndexInLine);
    const secondPrevFeatures = tempResult.get(secondIndexInLine);

    // Block double-kashida on same character
    if (secondPrevFeatures?.find(a => a.name === 'cv01'))
      return AppliedResult.Forbidden;

    const chark3 = this.lineText[firstIndexInLine];
    const chark4 = this.lineText[secondIndexInLine];

    // Forbidden pairs
    if (chark4 === 'ق' && subWordInfo.baseIndexes.at(-1) === secondMatchIndex) {
      return AppliedResult.Forbidden;
    } else if (
      chark3 === 'ل' &&
      (chark4 === 'ك' ||
        chark4 === 'د' ||
        chark4 === 'ذ' ||
        chark4 === 'ة' ||
        (chark4 === 'ه' && subWordInfo.baseIndexes.at(-1) === secondMatchIndex))
    ) {
      return AppliedResult.Forbidden;
    } else if (
      'ئبتثنيى'.includes(chark3) &&
      subWordInfo.baseIndexes[0] !== firstMatchIndex &&
      'رز'.includes(chark4)
    ) {
      return AppliedResult.Forbidden;
    }

    const secondNewFeatures: {name: string; value: number}[] = [];

    let cv01Value = 0;

    const firstAppliedFeatures: AppliedFeature[] = [
      {
        feature: {name: 'cv01', value: 1},
        calcNewValue: (prev, curr) => {
          cv01Value = Math.min((prev || 0) + curr, 6);
          return cv01Value;
        },
      },
    ];

    if ('بتثنيئ'.includes(chark3)) {
      firstAppliedFeatures.push({feature: {name: 'cv10', value: 1}});
    }

    const finalSubWordMatch =
      subWordInfo.baseIndexes.at(-1) === secondMatchIndex;

    // Decomposition features (cv11–cv18)
    if ('ه'.includes(chark3) && 'م'.includes(chark4) && finalSubWordMatch) {
      firstAppliedFeatures.push({feature: {name: 'cv11', value: 1}});
      secondNewFeatures.push({name: 'cv11', value: 1});
    } else if (
      'بتثنيئ'.includes(chark3) &&
      subWordInfo.baseIndexes[0] === firstMatchIndex &&
      'جحخ'.includes(chark4)
    ) {
      firstAppliedFeatures.push({feature: {name: 'cv12', value: 1}});
      secondNewFeatures.push({name: 'cv12', value: 1});
    } else if (
      'م'.includes(chark3) &&
      subWordInfo.baseIndexes[0] === firstMatchIndex &&
      'جحخ'.includes(chark4)
    ) {
      firstAppliedFeatures.push({feature: {name: 'cv13', value: 1}});
      secondNewFeatures.push({name: 'cv13', value: 1});
    } else if (
      'فق'.includes(chark3) &&
      subWordInfo.baseIndexes[0] === firstMatchIndex &&
      'جحخ'.includes(chark4)
    ) {
      firstAppliedFeatures.push({feature: {name: 'cv14', value: 1}});
      secondNewFeatures.push({name: 'cv14', value: 1});
    } else if (
      'ل'.includes(chark3) &&
      subWordInfo.baseIndexes[0] === firstMatchIndex &&
      'جحخ'.includes(chark4)
    ) {
      firstAppliedFeatures.push({feature: {name: 'cv15', value: 1}});
      secondNewFeatures.push({name: 'cv15', value: 1});
    } else if (
      'عغ'.includes(chark3) &&
      subWordInfo.baseIndexes[0] === firstMatchIndex &&
      ('آادذٱأإل'.includes(chark4) ||
        ('بتثنيئ'.includes(chark4) && 'سش'.includes(subWordInfo.baseText?.[2])))
    ) {
      firstAppliedFeatures.push({feature: {name: 'cv16', value: 1}});
      secondNewFeatures.push({name: 'cv16', value: 1});
    } else if ('جحخ'.includes(chark3)) {
      if (
        'آادذٱأإل'.includes(chark4) ||
        ('هة'.includes(chark4) && finalSubWordMatch) ||
        ('بتثنيئ'.includes(chark4) &&
          subWordInfo.baseIndexes.at(-2) === secondMatchIndex &&
          'رزن'.includes(subWordInfo.baseText.at(-1)!))
      ) {
        firstAppliedFeatures.push({feature: {name: 'cv16', value: 1}});
        secondNewFeatures.push({name: 'cv16', value: 1});
      } else if (
        subWordInfo.baseIndexes[0] === firstMatchIndex &&
        'م'.includes(chark4)
      ) {
        firstAppliedFeatures.push({feature: {name: 'cv18', value: 1}});
        secondNewFeatures.push({name: 'cv18', value: 1});
      }
    } else if ('سشصض'.includes(chark3) && 'رز'.includes(chark4)) {
      firstAppliedFeatures.push({feature: {name: 'cv17', value: 1}});
      secondNewFeatures.push({name: 'cv17', value: 1});
    }

    const firstNewFeatures = this.mergeFeatures(
      firstPrevFeatures,
      firstAppliedFeatures,
    )!;

    let cv02Value: number;
    if (finalAscendant.includes(chark4) && finalSubWordMatch) {
      cv02Value = cv01Value;
    } else {
      cv02Value = 2 * cv01Value;
    }

    secondNewFeatures.push({name: 'cv02', value: cv02Value});

    tempResult.set(firstIndexInLine, firstNewFeatures);
    tempResult.set(secondIndexInLine, secondNewFeatures);

    return this.tryApplyFeatures(wordIndex, justInfo, tempResult);
  }

  private applyKaf(
    justInfo: JustInfo,
    wordIndex: number,
    subWordIndex: number,
    firstSubWordMatchIndex: number,
    secondSubWordMatchIndex: number,
  ): AppliedResult {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[wordIndex];
    const subWordInfo = wordInfo.subwords[subWordIndex];
    const firstMatchIndex = subWordInfo.baseIndexes[firstSubWordMatchIndex];
    const secondMatchIndex = subWordInfo.baseIndexes[secondSubWordMatchIndex];
    const firstIndexInLine = wordInfo.startIndex + firstMatchIndex;
    const secondIndexInLine = wordInfo.startIndex + secondMatchIndex;

    const tempResult = new Map(justInfo.fontFeatures);

    const firstPrevFeatures = tempResult.get(firstIndexInLine);
    const secondPrevFeatures = tempResult.get(secondIndexInLine);

    const firstAppliedFeatures: AppliedFeature[] = [
      {feature: {name: 'cv03', value: 1}, calcNewValue: () => 1},
    ];

    tempResult.set(
      firstIndexInLine,
      this.mergeFeatures(firstPrevFeatures, firstAppliedFeatures)!,
    );

    const secondAppliedFeatures: AppliedFeature[] = [
      {feature: {name: 'cv03', value: 1}, calcNewValue: () => 1},
    ];

    const secondMerged = this.mergeFeatures(
      secondPrevFeatures,
      secondAppliedFeatures,
    )!;
    tempResult.set(secondIndexInLine, secondMerged);

    // Adjust fatha on kaf if present
    let fathaIndex: number | undefined;
    if (this.lineText[firstIndexInLine + 1] === '\u064E') {
      fathaIndex = firstIndexInLine + 1;
    } else if (
      this.lineText[firstIndexInLine + 1] === '\u0651' &&
      this.lineText[firstIndexInLine + 2] === '\u064E'
    ) {
      fathaIndex = firstIndexInLine + 2;
    }

    if (fathaIndex !== undefined) {
      const cv01Value = secondMerged.find(a => a.name === 'cv01')?.value || 0;
      tempResult.set(fathaIndex, [
        {name: 'cv01', value: 1 + Math.floor(cv01Value / 3)},
      ]);
    }

    return this.tryApplyFeatures(wordIndex, justInfo, tempResult);
  }

  private applyAlternate(
    justInfo: JustInfo,
    wordIndex: number,
    indexInLine: number,
  ): AppliedResult {
    const tempResult = new Map(justInfo.fontFeatures);
    const prevFeatures = tempResult.get(indexInLine);

    // If cv02 already applied, forbidden
    const cv02Value = prevFeatures?.find(a => a.name === 'cv02')?.value || 0;
    if (cv02Value > 0) return AppliedResult.Forbidden;

    const newFeatures = this.mergeFeatures(prevFeatures, [
      {
        feature: {name: 'cv01', value: 1},
        calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 12),
      },
    ])!;
    tempResult.set(indexInLine, newFeatures);

    // Adjust fatha if present
    let fathaIndex: number | undefined;
    if (this.lineText[indexInLine + 1] === '\u064E') {
      fathaIndex = indexInLine + 1;
    } else if (
      this.lineText[indexInLine + 1] === '\u0651' &&
      this.lineText[indexInLine + 2] === '\u064E'
    ) {
      fathaIndex = indexInLine + 2;
    }

    if (fathaIndex !== undefined) {
      const cv01FathaValue =
        newFeatures.find(a => a.name === 'cv01')?.value || 0;
      tempResult.set(fathaIndex, [
        {name: 'cv01', value: 1 + Math.floor(cv01FathaValue / 3)},
      ]);
    }

    return this.tryApplyFeatures(wordIndex, justInfo, tempResult);
  }

  private tryApplyFeatures(
    wordIndex: number,
    justInfo: JustInfo,
    newFeatures: Map<number, SkTextFontFeatures[]>,
  ): AppliedResult {
    const layout = justInfo.layoutResults[wordIndex];

    const paragraph = this.shapeWord(wordIndex, newFeatures);
    const wordNewWidth = paragraph.getLongestLine();
    paragraph.dispose();

    const diff = wordNewWidth - layout.parWidth;

    if (
      wordNewWidth !== layout.parWidth &&
      justInfo.textLineWidth + diff < justInfo.desiredWidth
    ) {
      justInfo.textLineWidth += diff;
      layout.parWidth = wordNewWidth;
      justInfo.fontFeatures = newFeatures;
      return AppliedResult.Positive;
    } else if (diff === 0) {
      return AppliedResult.NoChange;
    } else {
      return AppliedResult.Overflow;
    }
  }

  private mergeFeatures(
    prevFeatures: SkTextFontFeatures[] | undefined,
    newFeatures: AppliedFeature[],
  ): SkTextFontFeatures[] | undefined {
    let mergedFeatures: SkTextFontFeatures[];

    if (prevFeatures) {
      mergedFeatures = prevFeatures.map(x => Object.assign({}, x));
    } else {
      mergedFeatures = [];
    }

    for (const newFeature of newFeatures) {
      const exist = mergedFeatures.find(
        prevFeature => prevFeature.name === newFeature.feature.name,
      );
      if (exist) {
        exist.value = newFeature.calcNewValue
          ? newFeature.calcNewValue(exist.value, newFeature.feature.value)
          : newFeature.feature.value;
      } else {
        const cloneNewFeature = {
          name: newFeature.feature.name,
          value: newFeature.calcNewValue
            ? newFeature.calcNewValue(undefined, newFeature.feature.value)
            : newFeature.feature.value,
        };
        mergedFeatures.push(cloneNewFeature);
      }
    }

    return mergedFeatures;
  }

  private shapeWord(
    wordIndex: number,
    justResults: Map<number, SkTextFontFeatures[]>,
  ): SkParagraph {
    const wordInfo = this.lineTextInfo.wordInfos[wordIndex];

    const paragraphBuilder = this.paraBuilder;
    paragraphBuilder.reset();
    paragraphBuilder.pushStyle(this.textStyle);

    for (let i = wordInfo.startIndex; i <= wordInfo.endIndex; i++) {
      const char = this.lineText.charAt(i);
      const justInfo = justResults.get(i);

      if (justInfo) {
        const newtextStyle: SkTextStyle = {
          ...this.textStyle,
          fontFeatures: justInfo,
        };
        paragraphBuilder.pushStyle(newtextStyle);
        paragraphBuilder.addText(char);
        paragraphBuilder.pop();
      } else {
        paragraphBuilder.addText(char);
      }
    }

    const paragraph = paragraphBuilder.pop().build();
    paragraph.layout(this.parInfiniteWidth);
    return paragraph;
  }

  /**
   * Calculate justification for an entire page
   */
  static getPageLayout(
    pageNumber: number,
    fontSizeLineWidthRatio: number,
    fontMgr: SkTypefaceFontProvider,
    fontFamily: string = 'DigitalKhatt',
  ): JustResultByLine[] {
    const cachedPage = JustService.getCachedPageLayout(
      fontSizeLineWidthRatio,
      pageNumber,
      fontFamily,
    );
    if (cachedPage) {
      return cachedPage;
    }

    const paraBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    const result: JustResultByLine[] = [];

    // Get all lines for this page from the data service
    const {digitalKhattDataService} = require('./DigitalKhattDataService');
    const pageLines = digitalKhattDataService.getPageLines(pageNumber);

    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const lineInfo = quranTextService.getLineInfo(pageNumber, lineIndex);
      const lineTextInfo = quranTextService.analyzeText(pageNumber, lineIndex);

      if (
        lineInfo.lineType === 1 ||
        (lineInfo.lineType === 2 && pageNumber !== 1 && pageNumber !== 2)
      ) {
        result.push({
          fontFeatures: new Map(),
          simpleSpacing: SPACEWIDTH,
          ayaSpacing: SPACEWIDTH,
          fontSizeRatio: 1,
        });
      } else {
        const lineWidthRatio = lineInfo.lineWidthRatio;
        const justService = new JustService(
          pageNumber,
          lineIndex,
          lineTextInfo,
          fontMgr,
          fontSizeLineWidthRatio,
          lineWidthRatio,
          paraBuilder,
          fontFamily,
        );
        result.push(justService.justifyLine());
      }
    }

    JustService.cachePageLayout(
      fontSizeLineWidthRatio,
      pageNumber,
      result,
      fontFamily,
    );
    return result;
  }

  static getCachedPageLayout(
    fontSizeLineWidthRatio: number,
    pageNumber: number,
    fontFamily: string = 'DigitalKhatt',
  ): JustResultByLine[] | undefined {
    // 1. Check in-memory cache (fastest)
    const pageCache = getPageLayoutCache(fontSizeLineWidthRatio, fontFamily);
    const memoryHit = pageCache.get(pageNumber);
    if (memoryHit) return memoryHit;

    // 2. Check MMKV (synchronous, ~1ms)
    try {
      const {mushafLayoutCacheService} = require('./MushafLayoutCacheService');
      const mmkvHit = mushafLayoutCacheService.getPageLayout(
        pageNumber,
        fontFamily,
      );
      if (mmkvHit) {
        // Populate in-memory cache for fastest subsequent access
        pageCache.set(pageNumber, mmkvHit);
        return mmkvHit;
      }
    } catch {
      // MMKV not available yet, fall through
    }

    return undefined;
  }

  static cachePageLayout(
    fontSizeLineWidthRatio: number,
    pageNumber: number,
    layout: JustResultByLine[],
    fontFamily: string = 'DigitalKhatt',
  ): void {
    const pageCache = getPageLayoutCache(fontSizeLineWidthRatio, fontFamily);
    pageCache.set(pageNumber, layout);
  }
}

export function replacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from((value as Map<unknown, unknown>).entries()),
    };
  }
  return value;
}

export function reviver(key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    if ((value as {dataType?: string}).dataType === 'Map') {
      return new Map((value as {value: [unknown, unknown][]}).value);
    }
  }
  return value;
}

function getPageLayoutCache(
  fontSizeLineWidthRatio: number,
  fontFamily: string,
): Map<number, JustResultByLine[]> {
  const cacheKey = `${fontFamily}::${fontSizeLineWidthRatio}`;
  const existing = pageLayoutsCache.get(cacheKey);
  if (existing) return existing;
  const created = new Map<number, JustResultByLine[]>();
  pageLayoutsCache.set(cacheKey, created);
  return created;
}

const pageLayoutsCache: Map<
  string,
  Map<number, JustResultByLine[]>
> = new Map();
