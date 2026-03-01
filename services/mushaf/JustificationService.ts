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
} from './QuranTextService';

const lineParStyle = {
  textAlign: TextAlign.Left,
  textHeightBehavior: TextHeightBehavior.DisableAll,
};

export interface JustResultByLine {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  simpleSpacing: number;
  ayaSpacing: number;
  fontSizeRatio: number;
}

interface JustInfo {
  fontFeatures: Map<number, SkTextFontFeatures[]>;
  desiredWidth: number;
  textLineWidth: number;
  layoutResult: LayoutResult[];
}

interface LayoutResult {
  parHeight: number;
  parWidth: number;
}

interface LookupContext {
  justInfo: JustInfo;
  wordIndex: number;
  groups?: {[key: string]: [number, number]};
}

interface ApplyContext {
  prevFeatures: SkTextFontFeatures[] | undefined;
  char: string;
  wordIndex: number;
  charIndex: number;
}

type ActionFunction = {
  apply: (context: ApplyContext) => SkTextFontFeatures[] | undefined;
};
type ActionValue = {
  name: string;
  value?: number;
  calcNewValue: (prev: number | undefined, curr: number) => number;
};

type Action = ActionFunction | ActionValue;

interface Appliedfeature {
  feature: SkTextFontFeatures;
  calcNewValue?: (prev: number | undefined, curr: number) => number;
}

interface Lookup {
  condition?: (context: LookupContext) => boolean;
  matchingCondition?: (context: LookupContext) => boolean;
  regExprs: RegExp | RegExp[];
  actions: {[key: string]: Action[]};
}

/**
 * Compute named group indices from a regex match without the `d` flag.
 * Kept as a fallback for environments that don't support the `d` flag,
 * but all current regex patterns use `"gdu"` so this should not be reached
 * on Hermes (RN 0.73+).
 *
 * Returns an object mapping group names to [startIndex, endIndex] arrays
 * (relative to the input string, matching match.indices.groups format).
 */
function computeGroupIndices(
  match: RegExpExecArray,
): {[key: string]: [number, number]} | undefined {
  if (!match.groups) return undefined;

  const result: {[key: string]: [number, number]} = {};
  const matchStart = match.index ?? 0;
  const inputStr = match.input || '';

  // Collect all defined group names and their values
  const groupNames = Object.keys(match.groups).filter(
    name => match.groups![name] !== undefined,
  );

  if (groupNames.length === 0) return undefined;

  // Sort groups by their likely position in the string.
  // In the regex patterns used here, the groups appear in order within the word:
  //   k1 before k2 (behBeh pattern)
  //   k3 before k4/k5 (finalAssendant / generalKashida patterns)
  // We find positions by scanning the input from left to right.

  // Track search position to handle groups appearing in order
  let searchFrom = matchStart;

  // Process groups in pattern order: k1/k3 first, then k2/k4/k5
  const firstGroups = groupNames.filter(n => n === 'k1' || n === 'k3');
  const secondGroups = groupNames.filter(
    n => n === 'k2' || n === 'k4' || n === 'k5',
  );
  const orderedGroups = [...firstGroups, ...secondGroups];

  for (const name of orderedGroups) {
    const groupValue = match.groups[name]!;

    // Find this group's value in the input string, starting from searchFrom.
    // Skip over combining marks (Arabic diacritics) between groups.
    const idx = inputStr.indexOf(groupValue, searchFrom);
    if (idx >= 0) {
      result[name] = [idx, idx + groupValue.length];
      // Next group should be found after this one (+ any combining marks)
      searchFrom = idx + groupValue.length;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

const finalIsolAlternates = 'ىصضسشفقبتثنكيئ';

const dualJoinLetters = quranTextService.dualJoinLetters;
const rightNoJoinLetters = quranTextService.rightNoJoinLetters;

// --- Simple justification helpers (used by IndoPak) ---

const basesSet = new Set<number>();
for (let i = 0; i < dualJoinLetters.length; i++) {
  basesSet.add(dualJoinLetters.charCodeAt(i));
}
for (let i = 0; i < rightNoJoinLetters.length; i++) {
  basesSet.add(rightNoJoinLetters.charCodeAt(i));
}

interface SimpleSubWordInfo {
  baseText: string;
  baseIndexes: number[];
}

const enum SimpleAppliedResult {
  NoChange,
  Positive,
  Overflow,
  Forbidden,
}

const rightCharsSimple = dualJoinLetters;
const leftCharsSimple = dualJoinLetters + rightNoJoinLetters.replace('ء', '');
const rightKashSimple = rightCharsSimple.replace(/[لك]/gu, '');
const leftKashidaFinaSimple = leftCharsSimple.replace(/[وهصضطظ]/gu, '');
const leftKashidaMediSimple = leftKashidaFinaSimple.replace('ه', '');
const finalAscendantSimple = 'آادذٱأإكلهة';
const jhkSimple = 'جحخ';

const simpleAltFinPat = `^.*([بتثفكنصضسشقيئى])$`;
const simpleAltFinReg = new RegExp(simpleAltFinPat, 'gdu');
const simpleFinalKashidaEndWord = `^.*([${rightKashSimple}][آاٱأإملهة])$`;
const simpleFinalKashida = `^.*([${rightKashSimple}][دذآاٱأإملهة])$`;
const simpleHahKashida = `^.*([${jhkSimple}][${leftKashidaMediSimple}]).*$|^.*([${jhkSimple}][هة])$`;
const simpleHahFinaAscenReg = new RegExp(
  simpleHahKashida + '|' + simpleFinalKashidaEndWord,
  'gdu',
);
const simpleBehBehPat = `^.+([بتثنيسشصض][بتثنيم]).+$`;
const simpleRehPat = `.*([${rightKashSimple}][رز])`;
const simpleOtherPat = `.*([${rightKashSimple}](?:[ل]|[${leftKashidaMediSimple}]))`;
const simpleKafPat = `^.*([ك].).*$`;
const simplePatternAll =
  simpleAltFinPat +
  '|' +
  simpleHahKashida +
  '|' +
  simpleFinalKashida +
  '|' +
  simpleBehBehPat +
  '|' +
  simpleRehPat +
  '|' +
  simpleOtherPat +
  '|' +
  simpleKafPat;
const simpleRegExprAll = new RegExp(simplePatternAll, 'gdu');

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
    const layOutResult: LayoutResult[] = [];

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
      const parHeight = paragraph.getHeight();
      const parWidth = paragraph.getLongestLine();

      textWidthByWord += parWidth;
      layOutResult.push({parHeight, parWidth});
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

      // Kashida stretching (skip for IndoPak — no cv01/cv02 font features)
      if (
        desiredWidth > currentLineWidth &&
        this.fontFamily !== 'DigitalKhattIndoPak'
      ) {
        justResults = this.stretchLine(
          layOutResult,
          currentLineWidth,
          desiredWidth,
        );
        currentLineWidth = justResults.textLineWidth;
      }

      // Full justify with remaining space
      if (desiredWidth > currentLineWidth) {
        const addToSpace =
          (desiredWidth - currentLineWidth) / lineTextInfo.spaces.size;
        simpleSpacing = (simpleSpaceWidth + addToSpace) / scale;
        ayaSpacing = (ayaSpaceWidth + addToSpace) / scale;
      } else {
        simpleSpacing = simpleSpaceWidth / scale;
        ayaSpacing = ayaSpaceWidth / scale;
      }
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

  private stretchLine(
    layoutResult: LayoutResult[],
    initialLineWidth: number,
    desiredWidth: number,
  ): JustInfo {
    const right =
      'بتثنيئ' + 'جحخ' + 'سش' + 'صض' + 'طظ' + 'عغ' + 'فق' + 'لم' + 'ه';
    const wordInfos = this.lineTextInfo.wordInfos;

    const justInfo: JustInfo = {
      textLineWidth: initialLineWidth,
      fontFeatures: new Map(),
      layoutResult,
      desiredWidth,
    };

    const behafterbeh = `^.*(?:[${dualJoinLetters}]\\p{Mn}*)+(?<k1>[بتثنيسشصض])\\p{Mn}*(?<k2>[بتثنيم])\\p{Mn}*(?:\\p{L}\\p{Mn}*)+$`;

    const behBehLookup: Lookup = {
      regExprs: new RegExp(behafterbeh, 'gdu'),
      actions: {
        k1: [
          {
            apply: (context: ApplyContext) => {
              const newFeatures: Appliedfeature[] = [
                {
                  feature: {name: 'cv01', value: 1},
                  calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6),
                },
              ];
              if ('بتثنيئ'.includes(context.char)) {
                newFeatures.push({feature: {name: 'cv10', value: 1}});
              }
              return this.mergeFeatures(context.prevFeatures, newFeatures);
            },
          },
        ],
        k2: [
          {
            name: 'cv02',
            calcNewValue: (prev, curr) => (prev || 0) + 2 * curr,
          },
        ],
      },
    };

    const finalAssendantRegExprs = [
      new RegExp(
        `${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k4>["آادذٱأإ"]).*$`,
        'gdu',
      ),
      new RegExp(
        `${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k4>[كله])\\p{Mn}[${rightNoJoinLetters}].*$`,
        'gdu',
      ),
    ];

    const finalAssensantLookup: Lookup = {
      regExprs: finalAssendantRegExprs,
      matchingCondition: (context: LookupContext) =>
        this.matchingCondition(context),
      actions: {
        k3: [
          {
            apply: (context: ApplyContext) => {
              const newFeatures: Appliedfeature[] = [
                {
                  feature: {name: 'cv01', value: 1},
                  calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6),
                },
              ];
              if ('بتثنيئ'.includes(context.char)) {
                newFeatures.push({feature: {name: 'cv10', value: 1}});
              }
              return this.mergeFeatures(context.prevFeatures, newFeatures);
            },
          },
        ],
        k4: [
          {
            name: 'cv02',
            calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6),
          },
        ],
      },
    };

    const left = 'ئبتثني' + 'جحخ' + 'طظ' + 'عغ' + 'فق' + 'ةلم' + 'ر';
    const mediLeftAsendant = 'ل';

    const generalKashidaLookup: Lookup = {
      regExprs: [
        ...finalAssendantRegExprs,
        new RegExp(
          `${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k5>[${mediLeftAsendant}]).*$`,
          'gdu',
        ),
        new RegExp(
          `${behafterbeh}|^.*(?<k3>[${right}])\\p{Mn}*(?<k5>[${left}]).*$`,
          'gdu',
        ),
      ],
      matchingCondition: (context: LookupContext) =>
        this.matchingCondition(context),
      condition: (context: LookupContext) => {
        const group = context?.groups?.['k5'];
        if (group) {
          const wordInfo = wordInfos[context.wordIndex];
          const charIndex = group[0];
          const char = wordInfo.text[charIndex];
          if (
            finalIsolAlternates.includes(char) &&
            quranTextService.isLastBase(wordInfo.text, charIndex)
          ) {
            return false;
          }
        }
        return true;
      },
      actions: {
        k3: [
          {
            apply: (context: ApplyContext) => {
              const newFeatures: Appliedfeature[] = [
                {
                  feature: {name: 'cv01', value: 1},
                  calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6),
                },
              ];
              if ('بتثنيئ'.includes(context.char)) {
                newFeatures.push({feature: {name: 'cv10', value: 1}});
              }
              return this.mergeFeatures(context.prevFeatures, newFeatures);
            },
          },
        ],
        k4: [
          {
            name: 'cv02',
            calcNewValue: (prev, curr) => Math.min((prev || 0) + curr, 6),
          },
        ],
        k5: [
          {
            name: 'cv02',
            calcNewValue: (prev, curr) => (prev || 0) + curr * 2,
          },
        ],
      },
    };

    const kafAltLookup: Lookup = {
      regExprs: new RegExp(`^.*(?<k1>[ك])\\p{Mn}*(?<k2>\\p{L}).*$`, 'gdu'),
      actions: {
        k1: [{name: 'cv03', calcNewValue: () => 1}],
        k2: [{name: 'cv03', calcNewValue: () => 1}],
      },
    };

    // Apply lookups in order (matching the reference implementation exactly)
    this.applyLookupInc(justInfo, behBehLookup, 2);
    this.applyAlternates(justInfo, 'بتثكن', 2);
    this.applyLookupInc(justInfo, finalAssensantLookup, 2);
    this.applyLookupInc(justInfo, generalKashidaLookup, 1);
    this.applyDecomp(justInfo, '[جحخ]', '[هكلذداة]', 'cv16', 2, 4);

    this.applyDecomp(justInfo, '[ه]', '[م]', 'cv11', 1, 2);
    this.applyDecomp(justInfo, '[بتثني]', '[جحخ]', 'cv12', 1, 2);
    this.applyDecomp(justInfo, '[م]', '[جحخ]', 'cv13', 1, 2);
    this.applyDecomp(justInfo, '[فق]', '[جحخ]', 'cv14', 1, 2);
    this.applyDecomp(justInfo, '[ل]', '[جحخ]', 'cv15', 1, 2);

    this.applyDecomp(justInfo, '[سشصض]', '[ر]', 'cv17', 1, 2);
    this.applyDecomp(justInfo, '[جحخ]', '[م]', 'cv18', 1, 2);
    this.applyDecomp(justInfo, '[عغ]', '[دذا]', 'cv16', 1, 1);

    this.applyAlternates(justInfo, 'ىصضسشفقيئ', 2);
    this.applyLookupInc(justInfo, kafAltLookup, 1);

    this.applyLookupInc(justInfo, behBehLookup, 1);
    this.applyAlternates(justInfo, 'بتثكن', 1);
    this.applyLookupInc(justInfo, finalAssensantLookup, 1);
    this.applyLookupInc(justInfo, generalKashidaLookup, 1);

    this.applyAlternates(justInfo, 'ىصضسشفقيئ', 1);

    this.applyLookupInc(justInfo, behBehLookup, 2);
    this.applyAlternates(justInfo, 'بتثكن', 2);
    this.applyAlternates(justInfo, 'ىصضسشفقيئ', 2);

    this.applyLookupInc(justInfo, generalKashidaLookup, 2);

    return justInfo;
  }

  private applyAlternates(
    justInfo: JustInfo,
    chars: string,
    nbLevels: number,
  ): void {
    const patternExpa = `^.*(?<expa>[${chars}])(\\p{Mn}*(?<fatha>\u064E)\\p{Mn}*|\\p{Mn}*)$`;
    const regExprExpa = new RegExp(patternExpa, 'gdu');

    const expaLookup: Lookup = {
      regExprs: regExprExpa,
      actions: {
        expa: [
          {
            name: 'cv01',
            calcNewValue: (prev, curr) => (prev || 0) + curr,
          },
        ],
        fatha: [
          {
            name: 'cv01',
            calcNewValue: (prev, curr) =>
              !prev
                ? 1 + Math.floor(curr / 3)
                : 1 + Math.floor((prev * 2.5 + curr) / 3),
          },
        ],
      },
    };

    this.applyLookupInc(justInfo, expaLookup, nbLevels);
  }

  private applyDecomp(
    justInfo: JustInfo,
    firstChars: string,
    secondChars: string,
    featureName: string,
    firstLevel?: number,
    secondLevel?: number,
  ): void {
    const decompLookup: Lookup = {
      regExprs: new RegExp(
        `^.*(?<k1>${firstChars})\\p{Mn}*(?<k2>${secondChars}).*$`,
        'gdu',
      ),
      actions: {
        k1: [{name: featureName, calcNewValue: () => 1}],
        k2: [{name: featureName, calcNewValue: () => 1}],
      },
    };

    if (firstLevel) {
      decompLookup.actions.k1.push({
        name: 'cv01',
        calcNewValue: () => firstLevel,
      });
    }

    if (secondLevel) {
      decompLookup.actions.k2.push({
        name: 'cv02',
        calcNewValue: () => secondLevel,
      });
    }

    this.applyLookupInc(justInfo, decompLookup, 1);
  }

  private applyLookupInc(
    justInfo: JustInfo,
    lookup: Lookup,
    nbLevels: number,
  ): void {
    const wordInfos = this.lineTextInfo.wordInfos;
    for (let level = 1; level <= nbLevels; level++) {
      for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
        this.applyLookup(justInfo, wordIndex, lookup, 1);
      }
    }
  }

  private applyLookup(
    justInfo: JustInfo,
    wordIndex: number,
    lookup: Lookup,
    level: number,
  ): void {
    const wordInfos = this.lineTextInfo.wordInfos;
    let result = justInfo.fontFeatures;
    const wordInfo = wordInfos[wordIndex];
    const layout = justInfo.layoutResult[wordIndex];

    const regExprs = Array.isArray(lookup.regExprs)
      ? lookup.regExprs
      : [lookup.regExprs];

    let matched = false;

    for (let regIndex = 0; regIndex < regExprs.length && !matched; regIndex++) {
      const regExpr = regExprs[regIndex];
      regExpr.lastIndex = 0;

      const match = regExpr.exec(wordInfo.text);
      if (!match) continue;

      // Use d-flag indices if available (V8), fall back to manual computation (Hermes)
      const groups =
        (match as any)?.indices?.groups || computeGroupIndices(match);

      if (lookup.matchingCondition) {
        if (!lookup.matchingCondition({justInfo, wordIndex, groups})) continue;
      }

      matched = true;

      if (lookup.condition) {
        if (!lookup.condition({justInfo, wordIndex, groups})) return;
      }

      const tempResult = new Map(result);

      for (const key in groups) {
        const group = groups[key];
        if (!group) continue;

        const actions = lookup.actions[key];
        if (!actions) continue;

        for (const action of actions) {
          const indexInLine = group[0] + wordInfo.startIndex;
          const prevFeatures = tempResult.get(indexInLine);
          let newFeatures: SkTextFontFeatures[] | undefined;

          if ('name' in action) {
            const newValue = action.value || level;
            newFeatures = this.mergeFeatures(prevFeatures, [
              {
                feature: {name: action.name, value: newValue},
                calcNewValue: action.calcNewValue,
              },
            ]);
          } else {
            newFeatures = action.apply({
              prevFeatures,
              char: wordInfo.text[group[0]],
              wordIndex,
              charIndex: group[0],
            });
          }

          if (newFeatures) {
            tempResult.set(indexInLine, newFeatures);
          } else {
            tempResult.delete(indexInLine);
          }
        }
      }

      const paragraph = this.shapeWord(wordIndex, tempResult);
      const wordNewWidth = paragraph.getLongestLine();

      if (
        wordNewWidth !== layout.parWidth &&
        justInfo.textLineWidth + wordNewWidth - layout.parWidth <
          justInfo.desiredWidth
      ) {
        justInfo.textLineWidth += wordNewWidth - layout.parWidth;
        layout.parWidth = wordNewWidth;
        justInfo.fontFeatures = tempResult;
        result = tempResult;
      }
    }
  }

  private mergeFeatures(
    prevFeatures: SkTextFontFeatures[] | undefined,
    newFeatures: Appliedfeature[],
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

  // --- Simple justification (IndoPak) ---

  private computeSubwords(wordText: string): {
    baseText: string;
    subwords: SimpleSubWordInfo[];
  } {
    const subwords: SimpleSubWordInfo[] = [{baseText: '', baseIndexes: []}];
    let fullBaseText = '';

    for (let i = 0; i < wordText.length; i++) {
      const char = wordText.charAt(i);
      if (!basesSet.has(char.charCodeAt(0))) continue;

      fullBaseText += char;

      let isHamza = false;
      if (char === 'ء') {
        subwords.push({baseText: '', baseIndexes: []});
        isHamza = true;
      }

      const subWord = subwords[subwords.length - 1];
      subWord.baseText += char;
      subWord.baseIndexes.push(i);

      if (
        i < wordText.length - 1 &&
        rightNoJoinLetters.includes(char) &&
        !isHamza
      ) {
        subwords.push({baseText: '', baseIndexes: []});
      }
    }

    return {baseText: fullBaseText, subwords};
  }

  private stretchLineSimple(
    layoutResult: LayoutResult[],
    initialLineWidth: number,
    desiredWidth: number,
  ): JustInfo {
    const wordInfos = this.lineTextInfo.wordInfos;

    const justInfo: JustInfo = {
      textLineWidth: initialLineWidth,
      fontFeatures: new Map(),
      layoutResult,
      desiredWidth,
    };

    // Pre-compute subwords for each word
    const wordSubwords = wordInfos.map(wi => this.computeSubwords(wi.text));

    // Phase 1: Match each word to a stretch type (priority 1 > 2 > 3)
    interface SubWordMatch {
      subWordIndex: number;
      match: RegExpExecArray | null;
      type: number;
    }

    const matchResult: SubWordMatch[] = [];

    // IndoPak: firstWordIncluded = false → skip word 0
    const firstWordIndex = 1;

    for (let wordIndex = 0; wordIndex < wordInfos.length; wordIndex++) {
      const result: SubWordMatch = {subWordIndex: -1, match: null, type: 0};
      const wordInfo = wordInfos[wordIndex];

      if (
        !wordSubwords[wordIndex].baseText.length ||
        wordIndex < firstWordIndex
      ) {
        matchResult[wordIndex] = result;
        continue;
      }

      const lastIndex = wordSubwords[wordIndex].subwords.length - 1;
      let subWord = wordSubwords[wordIndex].subwords[lastIndex];

      // Priority 1: final/isolated alternates
      simpleAltFinReg.lastIndex = 0;
      let match = simpleAltFinReg.exec(subWord.baseText);
      if (match) {
        result.subWordIndex = lastIndex;
        result.match = match;
        result.type = 1;
      } else if (
        !'يئى'.includes(
          wordSubwords[wordIndex].baseText[
            wordSubwords[wordIndex].baseText.length - 1
          ],
        )
      ) {
        // Priority 2: hah/final-ascendant kashida
        simpleHahFinaAscenReg.lastIndex = 0;
        match = simpleHahFinaAscenReg.exec(subWord.baseText);
        if (match) {
          result.subWordIndex = lastIndex;
          result.match = match;
          result.type = 2;
        } else {
          // Priority 3: general pattern (search all subwords from end)
          for (let subIndex = lastIndex; subIndex >= 0; subIndex--) {
            subWord = wordSubwords[wordIndex].subwords[subIndex];
            simpleRegExprAll.lastIndex = 0;
            match = simpleRegExprAll.exec(subWord.baseText);
            if (match) {
              result.subWordIndex = subIndex;
              result.match = match;
              result.type = 3;
              break;
            }
          }
        }
      }
      matchResult[wordIndex] = result;
    }

    // Phase 2: Apply stretching
    const stretchedWords = new Map<number, boolean>();
    const nbLevelAlt = 2;
    const nbLevelKashida = 2;

    for (
      let level = 1;
      level <= Math.max(nbLevelAlt, nbLevelKashida);
      level++
    ) {
      for (
        let wordIndex = wordInfos.length - 1;
        wordIndex >= firstWordIndex;
        wordIndex--
      ) {
        // wordByWord = true → skip if neighbor was just stretched
        if (stretchedWords.get(wordIndex + 1)) continue;

        let appliedResult: SimpleAppliedResult | undefined;

        const subWordsMatch = matchResult[wordIndex];
        if (!subWordsMatch?.match) continue;

        const subWordIndex = subWordsMatch.subWordIndex;
        const subWordInfo = wordSubwords[wordIndex].subwords[subWordIndex];
        const wordInfo = wordInfos[wordIndex];

        const matchIndices = (subWordsMatch.match as any).indices;
        let matchIndex: number | undefined;
        for (let index = 1; index < matchIndices.length; index++) {
          if (matchIndices[index]) {
            matchIndex = index;
          }
        }
        if (matchIndex === undefined) continue;
        const matchRange = matchIndices[matchIndex];

        if (
          subWordsMatch.type === 1 ||
          (subWordsMatch.type === 3 && matchIndex === 1)
        ) {
          // Alternates
          if (level <= nbLevelAlt) {
            const baseIndex = matchRange[0];
            const indexInLine =
              wordInfo.startIndex + subWordInfo.baseIndexes[baseIndex];
            appliedResult = this.applyAlternateSimple(
              justInfo,
              wordIndex,
              indexInLine,
            );
          }
        } else if (level <= nbLevelKashida) {
          const firstSubWordMatchIndex = matchRange[0];
          const secondSubWordMatchIndex = firstSubWordMatchIndex + 1;

          if (matchIndex === 8 && subWordsMatch.type === 3) {
            // Kaf
            appliedResult = this.applyKafSimple(
              justInfo,
              wordIndex,
              subWordInfo,
              firstSubWordMatchIndex,
              secondSubWordMatchIndex,
            );
          } else {
            // Kashidas
            appliedResult = this.applyKashidaSimple(
              justInfo,
              wordIndex,
              subWordInfo,
              firstSubWordMatchIndex,
              secondSubWordMatchIndex,
            );
          }
        }

        if (appliedResult === SimpleAppliedResult.Overflow) {
          return justInfo;
        } else if (appliedResult === SimpleAppliedResult.Positive) {
          stretchedWords.set(wordIndex, true);
        }
      }
    }
    return justInfo;
  }

  private applyAlternateSimple(
    justInfo: JustInfo,
    wordIndex: number,
    indexInLine: number,
  ): SimpleAppliedResult {
    const tempResult = new Map(justInfo.fontFeatures);
    const prevFeatures = tempResult.get(indexInLine);

    // If cv02 already applied, forbidden
    const cv02Value = prevFeatures?.find(a => a.name === 'cv02')?.value || 0;
    if (cv02Value > 0) return SimpleAppliedResult.Forbidden;

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

    return this.tryApplyFeaturesSimple(wordIndex, justInfo, tempResult);
  }

  private applyKashidaSimple(
    justInfo: JustInfo,
    wordIndex: number,
    subWordInfo: SimpleSubWordInfo,
    first: number,
    second: number,
  ): SimpleAppliedResult {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[wordIndex];
    const firstMatchIndex = subWordInfo.baseIndexes[first];
    const secondMatchIndex = subWordInfo.baseIndexes[second];
    const firstIndexInLine = wordInfo.startIndex + firstMatchIndex;
    const secondIndexInLine = wordInfo.startIndex + secondMatchIndex;

    const tempResult = new Map(justInfo.fontFeatures);

    const firstPrevFeatures = tempResult.get(firstIndexInLine);
    const secondPrevFeatures = tempResult.get(secondIndexInLine);

    // If second char already has cv01, forbidden
    if (secondPrevFeatures?.find(a => a.name === 'cv01'))
      return SimpleAppliedResult.Forbidden;

    const chark3 = this.lineText[firstIndexInLine];
    const chark4 = this.lineText[secondIndexInLine];

    // Forbidden pairs
    if (
      chark4 === 'ق' &&
      subWordInfo.baseIndexes[subWordInfo.baseIndexes.length - 1] ===
        secondMatchIndex
    ) {
      return SimpleAppliedResult.Forbidden;
    } else if (
      chark3 === 'ل' &&
      (chark4 === 'ك' ||
        chark4 === 'د' ||
        chark4 === 'ذ' ||
        chark4 === 'ة' ||
        (chark4 === 'ه' &&
          subWordInfo.baseIndexes[subWordInfo.baseIndexes.length - 1] ===
            secondMatchIndex))
    ) {
      return SimpleAppliedResult.Forbidden;
    } else if (
      'ئبتثنيى'.includes(chark3) &&
      subWordInfo.baseIndexes[0] !== firstMatchIndex &&
      'رز'.includes(chark4)
    ) {
      return SimpleAppliedResult.Forbidden;
    }

    const secondNewFeatures: {name: string; value: number}[] = [];

    let cv01Value = 0;

    const firstAppliedFeatures: Appliedfeature[] = [
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
      subWordInfo.baseIndexes[subWordInfo.baseIndexes.length - 1] ===
      secondMatchIndex;

    // Decomposition features
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
          subWordInfo.baseIndexes[subWordInfo.baseIndexes.length - 2] ===
            secondMatchIndex &&
          'رزن'.includes(subWordInfo.baseText[subWordInfo.baseText.length - 1]))
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
    if (finalAscendantSimple.includes(chark4) && finalSubWordMatch) {
      cv02Value = cv01Value;
    } else {
      cv02Value = 2 * cv01Value;
    }

    secondNewFeatures.push({name: 'cv02', value: cv02Value});

    tempResult.set(firstIndexInLine, firstNewFeatures);
    tempResult.set(secondIndexInLine, secondNewFeatures);

    return this.tryApplyFeaturesSimple(wordIndex, justInfo, tempResult);
  }

  private applyKafSimple(
    justInfo: JustInfo,
    wordIndex: number,
    subWordInfo: SimpleSubWordInfo,
    first: number,
    second: number,
  ): SimpleAppliedResult {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[wordIndex];
    const firstMatchIndex = subWordInfo.baseIndexes[first];
    const secondMatchIndex = subWordInfo.baseIndexes[second];
    const firstIndexInLine = wordInfo.startIndex + firstMatchIndex;
    const secondIndexInLine = wordInfo.startIndex + secondMatchIndex;

    const tempResult = new Map(justInfo.fontFeatures);

    const firstPrevFeatures = tempResult.get(firstIndexInLine);
    const secondPrevFeatures = tempResult.get(secondIndexInLine);

    const firstAppliedFeatures: Appliedfeature[] = [
      {feature: {name: 'cv03', value: 1}, calcNewValue: () => 1},
    ];

    tempResult.set(
      firstIndexInLine,
      this.mergeFeatures(firstPrevFeatures, firstAppliedFeatures)!,
    );

    const secondAppliedFeatures: Appliedfeature[] = [
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

    return this.tryApplyFeaturesSimple(wordIndex, justInfo, tempResult);
  }

  private tryApplyFeaturesSimple(
    wordIndex: number,
    justInfo: JustInfo,
    newFeatures: Map<number, SkTextFontFeatures[]>,
  ): SimpleAppliedResult {
    const layout = justInfo.layoutResult[wordIndex];

    const paragraph = this.shapeWord(wordIndex, newFeatures);
    const wordNewWidth = paragraph.getLongestLine();
    const diff = wordNewWidth - layout.parWidth;

    if (
      wordNewWidth !== layout.parWidth &&
      justInfo.textLineWidth + diff < justInfo.desiredWidth
    ) {
      justInfo.textLineWidth += diff;
      layout.parWidth = wordNewWidth;
      justInfo.fontFeatures = newFeatures;
      return SimpleAppliedResult.Positive;
    } else if (diff === 0) {
      return SimpleAppliedResult.NoChange;
    } else {
      return SimpleAppliedResult.Overflow;
    }
  }

  private matchingCondition(context: LookupContext): boolean {
    const wordInfos = this.lineTextInfo.wordInfos;
    const wordInfo = wordInfos[context.wordIndex];

    if (wordInfo.baseText.length === 2 && !'سش'.includes(wordInfo.baseText)) {
      return false;
    }

    const k3 = context?.groups?.['k3'];
    const k4 = context?.groups?.['k4'] || context?.groups?.['k5'];
    if (k3 && k4) {
      const wi = wordInfos[context.wordIndex];
      const chark3 = wi.text[k3[0]];
      const chark4 = wi.text[k4[0]];
      const indexk3InLine = k3[0] + wi.startIndex;
      const prevk3Features = context.justInfo.fontFeatures.get(indexk3InLine);

      if (
        chark3 === 'ل' &&
        (chark4 === 'ك' || chark4 === 'د' || chark4 === 'ذ')
      ) {
        return false;
      } else if (
        'عغجحخ'.includes(chark3) &&
        !prevk3Features?.find(a => a.name === 'cv16') &&
        ('كلذداة'.includes(chark4) ||
          (chark4 === 'ه' && quranTextService.isLastBase(wi.text, k4[0])))
      ) {
        return false;
      }
    }
    return true;
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
