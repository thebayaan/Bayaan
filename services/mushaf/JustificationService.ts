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
} from './QuranTextService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const finalIsolAlternates = 'ىصضسشفقبتثنكيئ';

const dualJoinLetters = quranTextService.dualJoinLetters;
const rightNoJoinLetters = quranTextService.rightNoJoinLetters;

export class JustService {
  private lineText: string;
  private textStyle: SkTextStyle;
  private parInfiniteWidth: number;
  private lineWidth = 2000;
  private desiredWidth: number;
  private fontSize: number;
  private paraBuilder: SkParagraphBuilder;

  constructor(
    private pageNumber: number,
    private lineIndex: number,
    private lineTextInfo: LineTextInfo,
    private fontMgr: SkTypefaceFontProvider,
    private fontSizeLineWidthRatio: number,
    private lineWidthRatio: number,
    pParBuilder?: SkParagraphBuilder,
  ) {
    this.desiredWidth = lineWidthRatio * this.lineWidth;
    this.lineText = quranTextService.getLineText(pageNumber, lineIndex);
    this.parInfiniteWidth = 1.5 * this.desiredWidth;
    this.fontSize = this.fontSizeLineWidthRatio * this.lineWidth;

    this.textStyle = {
      fontFamilies: ['DigitalKhatt'],
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

      // Kashida stretching
      if (desiredWidth > currentLineWidth) {
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

      const groups = (match as any)?.indices?.groups;

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
  ): JustResultByLine[] {
    const paraBuilder = Skia.ParagraphBuilder.Make(lineParStyle, fontMgr);
    const result: JustResultByLine[] = [];

    const lines = quranTextService.getLineText(pageNumber, 0) ? true : false;

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
        );
        result.push(justService.justifyLine());
      }
    }

    return result;
  }

  /**
   * Calculate and cache all page layouts
   */
  static async saveAllLayouts(
    fontSizeLineWidthRatio: number,
    fontMgr: SkTypefaceFontProvider,
    onProgress?: (page: number, total: number) => void,
  ): Promise<void> {
    const allResults: JustResultByLine[][] = [];

    for (let pageNumber = 1; pageNumber <= 604; pageNumber++) {
      const pageResult = JustService.getPageLayout(
        pageNumber,
        fontSizeLineWidthRatio,
        fontMgr,
      );
      allResults.push(pageResult);
      onProgress?.(pageNumber, 604);
    }

    await JustService.saveLayoutToStorage(fontSizeLineWidthRatio, allResults);
  }

  static async saveLayoutToStorage(
    fontSizeLineWidthRatio: number,
    result: JustResultByLine[][],
  ): Promise<void> {
    const key = `dk_layout_${fontSizeLineWidthRatio}`;
    const json = JSON.stringify(result, replacer);
    await AsyncStorage.setItem(key, json);
    cachedLayouts.set(fontSizeLineWidthRatio, result);
  }

  static async getLayoutFromStorage(
    fontSizeLineWidthRatio: number,
  ): Promise<JustResultByLine[][] | undefined> {
    const cached = cachedLayouts.get(fontSizeLineWidthRatio);
    if (cached) return cached;

    const key = `dk_layout_${fontSizeLineWidthRatio}`;
    const json = await AsyncStorage.getItem(key);
    if (json) {
      const layout = JSON.parse(json, reviver) as JustResultByLine[][];
      cachedLayouts.set(fontSizeLineWidthRatio, layout);
      return layout;
    }
    return undefined;
  }

  static async removeLayouts(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const layoutKeys = keys.filter(k => k.startsWith('dk_layout_'));
    if (layoutKeys.length > 0) {
      await AsyncStorage.multiRemove(layoutKeys);
    }
    cachedLayouts.clear();
  }
}

function replacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from((value as Map<unknown, unknown>).entries()),
    };
  }
  return value;
}

function reviver(key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    if ((value as {dataType?: string}).dataType === 'Map') {
      return new Map((value as {value: [unknown, unknown][]}).value);
    }
  }
  return value;
}

const cachedLayouts: Map<number, JustResultByLine[][]> = new Map();
