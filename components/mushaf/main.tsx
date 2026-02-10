import * as SQLite from 'expo-sqlite';
import * as Font from 'expo-font';
import React, {useEffect, useState, useMemo, useRef, useCallback} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {Ionicons} from '@expo/vector-icons';
import BottomSheetModal from '@/components/BottomSheetModal';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {SURAHS} from '@/data/surahData';
import qpcGlyphs from '../../data/mushaf/qpc-v2.json';
import qpcGlyphsTajweed from '../../data/mushaf/qpc-v4.json';
import surahHeaderGlyphs from '@/data/mushaf/SURAH_HEADERS.json' with { type: 'json' };
const surahHeaderGlyphsMap = surahHeaderGlyphs as Record<string, string>;
import {SvgUri} from 'react-native-svg';
import {Asset} from 'expo-asset';

// Use require() for the SVG asset to avoid needing the SVG transformer
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BasmalahAsset = require('@/data/mushaf/Bismillah..svg');
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import { SURAH_NAMES } from './constants';
import { getFontRequires } from './fontRequires';

// Font cache to track which page fonts are already loaded
// Separate caches for each font type
const loadedFontsV1 = new Set<number>();
const loadedFontsTajweed = new Set<number>();

const surahHeaderFont = require('@/data/mushaf/SURAH_HEADERS.ttf');
const basmalahUri = Asset.fromModule(BasmalahAsset).uri;
let isSurahHeaderFontLoaded = false;

let isIndopakFontLoaded = false;

async function loadIndopakFont(): Promise<boolean> {
  if (isIndopakFontLoaded) return true;
  try {
    await Font.loadAsync({
      Indopak: require('@/data/mushaf/indopak/font.ttf'),
    });
    isIndopakFontLoaded = true;
    return true;
  } catch (error) {
    console.error('Error loading indopak font:', error);
    return false;
  }
}

// Function to load font for a specific page
async function loadPageFont(pageNumber: number, showTajweed: boolean): Promise<boolean> {
  const loadedFonts = showTajweed ? loadedFontsTajweed : loadedFontsV1;

  if (loadedFonts.has(pageNumber)) {
    return true;
  }

  const fontRequires = getFontRequires(showTajweed);
  const fontSource = fontRequires[pageNumber];
  if (!fontSource) {
    console.warn(`No font found for page ${pageNumber}`);
    return false;
  }

  try {
    const fontName = showTajweed ? `p${pageNumber}_tajweed` : `p${pageNumber}`;
    await Font.loadAsync({
      [fontName]: fontSource,
    });
    loadedFonts.add(pageNumber);
    return true;
  } catch (error) {
    console.error(`Error loading font for page ${pageNumber}:`, error);
    return false;
  }
}

async function loadSurahHeaderFont(): Promise<boolean> {
  if (isSurahHeaderFontLoaded) {
    return true;
  }

  try {
    await Font.loadAsync({
      SURAH_HEADERS: surahHeaderFont,
    });
    isSurahHeaderFontLoaded = true;
    return true;
  } catch (error) {
    console.error('Error loading surah header font:', error);
    return false;
  }
}

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const TOTAL_PAGES_QPC = 604;
const TOTAL_PAGES_INDOPAK = 610;
const LINES_PER_PAGE = 15;

// iPhone SE (2nd/3rd gen) has height 667, all Face ID iPhones are 812+
const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

// Tuned separately for compact (SE) vs modern devices
const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 8 : 16;
const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 30 : 110;
const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE ? 70 : 130;
const AYAH_LINE_SPACING = IS_COMPACT_DEVICE ? 0.75 : 0.70;

const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
const CONTENT_HEIGHT = SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
const BASE_LINE_HEIGHT = CONTENT_HEIGHT / LINES_PER_PAGE;

// Dynamic font scaling based on screen width (reference: iPhone 14/15 at 393px = 24pt)
const REFERENCE_WIDTH = 400;
const REFERENCE_FONT_SIZE = 24;
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 56;

const widthScale = SCREEN_WIDTH / REFERENCE_WIDTH;

// Height ceiling: font must fit within the ayah line height
const maxFontFromHeight = (CONTENT_HEIGHT / LINES_PER_PAGE) * AYAH_LINE_SPACING * 0.85;

// QPC and Indopak fonts have different metrics — separate ratios
const QPC_FONT_SIZE_RATIO = IS_COMPACT_DEVICE ? 0.90 : 0.85;
const INDOPAK_FONT_SIZE_RATIO = IS_COMPACT_DEVICE ? 0.85 : 0.95;

const QPC_FONT_SIZE = Math.max(MIN_FONT_SIZE,
  Math.min(Math.round(REFERENCE_FONT_SIZE * widthScale * QPC_FONT_SIZE_RATIO), maxFontFromHeight, MAX_FONT_SIZE)
);

const INDOPAK_FONT_SIZE = Math.max(MIN_FONT_SIZE,
  Math.min(Math.round(REFERENCE_FONT_SIZE * widthScale * INDOPAK_FONT_SIZE_RATIO), maxFontFromHeight, MAX_FONT_SIZE)
);

const SURAH_HEADER_FONT_SIZE = CONTENT_WIDTH * 0.25;
const SURAH_HEADER_COLOR = '#5D4037';

// Pre-process glyph data
const glyphsById: Record<number, string> = {};
for (const word of Object.values(qpcGlyphs)) {
  glyphsById[word.id] = word.text;
}

const glyphsByIdTajweed: Record<number, string> = {};
for (const word of Object.values(qpcGlyphsTajweed)) {
  glyphsByIdTajweed[word.id] = word.text;
}

const BASMALLAH = '﷽';

// Pre-loaded indopak word lookup (loaded once from DB)
let indopakWordsById: Record<number, string> = {};
let indopakWordsLoaded = false;
let indopakWordsLoading: Promise<void> | null = null;

async function loadIndopakWords(): Promise<void> {
  if (indopakWordsLoaded) return;
  if (indopakWordsLoading) return indopakWordsLoading;

  indopakWordsLoading = (async () => {
    try {
      let db = await SQLite.openDatabaseAsync('indopak_words.db');
      const tableCheck = await db
        .getFirstAsync<{name: string}>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='words';",
        )
        .catch(() => null);

      if (!tableCheck) {
        await db.closeAsync();
        await SQLite.deleteDatabaseAsync('indopak_words.db');
        await SQLite.importDatabaseFromAssetAsync('indopak_words.db', {
          assetId: require('../../data/mushaf/indopak/indopak-nastaleeq.db'),
        });
        db = await SQLite.openDatabaseAsync('indopak_words.db');
      }

      const rows = await db.getAllAsync<{id: number; text: string}>(
        'SELECT id, text FROM words;',
      );
      for (const row of rows) {
        indopakWordsById[row.id] = row.text;
      }
      indopakWordsLoaded = true;
      await db.closeAsync();
    } catch (error) {
      console.error('Error loading indopak words:', error);
    } finally {
      indopakWordsLoading = null;
    }
  })();

  return indopakWordsLoading;
}

// Create a mapping of page number to surah for quick lookup (QPC)
const QPC_PAGE_TO_SURAH: Record<number, number> = {};
SURAHS.forEach(surah => {
  const [start, end] = surah.pages.split('-').map(Number);
  for (let page = start; page <= end; page++) {
    if (!QPC_PAGE_TO_SURAH[page]) {
      QPC_PAGE_TO_SURAH[page] = surah.id;
    }
  }
});

const QPC_SURAH_START_PAGES: Record<number, number> = {};
SURAHS.forEach(surah => {
  const startPage = parseInt(surah.pages.split('-')[0], 10);
  QPC_SURAH_START_PAGES[surah.id] = startPage;
});

// Build indopak surah mappings from layout DB
async function buildIndopakSurahMappings(
  db: SQLite.SQLiteDatabase,
): Promise<{
  pageToSurah: Record<number, number>;
  surahStartPages: Record<number, number>;
}> {
  const pageToSurah: Record<number, number> = {};
  const surahStartPages: Record<number, number> = {};

  const rows = await db.getAllAsync<{page_number: number; surah_number: number}>(
    "SELECT page_number, surah_number FROM pages WHERE line_type='surah_name' ORDER BY page_number;",
  );

  // Build surah start pages from surah_name lines
  for (const row of rows) {
    if (!surahStartPages[row.surah_number]) {
      surahStartPages[row.surah_number] = row.page_number;
    }
  }

  // Fill page-to-surah for all pages
  const surahIds = Object.keys(surahStartPages)
    .map(Number)
    .sort((a, b) => surahStartPages[a] - surahStartPages[b]);

  for (let i = 0; i < surahIds.length; i++) {
    const surahId = surahIds[i];
    const startPage = surahStartPages[surahId];
    const endPage =
      i < surahIds.length - 1
        ? surahStartPages[surahIds[i + 1]] - 1
        : TOTAL_PAGES_INDOPAK;
    for (let page = startPage; page <= endPage; page++) {
      if (!pageToSurah[page]) {
        pageToSurah[page] = surahId;
      }
    }
  }

  return {pageToSurah, surahStartPages};
}

interface MushafLine {
  page_number: number;
  line_number: number;
  line_type: 'surah_name' | 'basmallah' | 'ayah';
  first_word_id: number;
  last_word_id: number;
  is_centered: 0 | 1;
  surah_number: number;
}

const PageView: React.FC<{
  pageNumber: number;
  layoutDb: SQLite.SQLiteDatabase | null;
  textColor: string;
  showTajweed: boolean;
  isIndopak: boolean;
}> = ({pageNumber, layoutDb, textColor, showTajweed, isIndopak}) => {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedFonts = showTajweed ? loadedFontsTajweed : loadedFontsV1;
  const [fontLoaded, setFontLoaded] = useState(
    isIndopak ? indopakWordsLoaded : loadedFonts.has(pageNumber),
  );
  const [surahHeaderFontLoaded, setSurahHeaderFontLoaded] = useState(
    isSurahHeaderFontLoaded,
  );

  // Load the page font
  useEffect(() => {
    let isActive = true;

    const loadFont = async () => {
      if (isIndopak) {
        const success = await loadIndopakFont();
        await loadIndopakWords();
        if (isActive) setFontLoaded(success && indopakWordsLoaded);
        return;
      }

      if (loadedFonts.has(pageNumber)) {
        setFontLoaded(true);
        return;
      }

      const success = await loadPageFont(pageNumber, showTajweed);
      if (isActive) {
        setFontLoaded(success);
      }
    };

    loadFont();
    return () => {
      isActive = false;
    };
  }, [pageNumber, showTajweed, loadedFonts, isIndopak]);

  useEffect(() => {
    let isActive = true;
    const loadFont = async () => {
      const success = await loadSurahHeaderFont();
      if (isActive) {
        setSurahHeaderFontLoaded(success);
      }
    };

    loadFont();
    return () => {
      isActive = false;
    };
  }, []);

  // Load page data from database
  useEffect(() => {
    if (!layoutDb) return;
    let isActive = true;

    const loadPageData = async () => {
      setLoading(true);
      try {
        const pageLines = await layoutDb.getAllAsync<MushafLine>(
          'SELECT * FROM pages WHERE page_number = ? ORDER BY line_number ASC;',
          [pageNumber],
        );
        if (!isActive) return;
        setLines(pageLines);
      } catch (error) {
        console.error('Error loading page data:', error);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadPageData();
    return () => {
      isActive = false;
    };
  }, [layoutDb, pageNumber]);

  if (loading || !fontLoaded || !surahHeaderFontLoaded) {
    return (
      <View style={[styles.page, styles.loadingContainer]}>
        <ActivityIndicator size="small" color={textColor} />
      </View>
    );
  }

  // Calculate line positions with tighter ayah spacing
  // Surah headers get more space, ayahs are tighter
  const linePositions: number[] = [];
  let currentY = 0;
  for (let i = 0; i < lines.length; i++) {
    linePositions.push(currentY);
    const lineHeight =
      lines[i].line_type === 'surah_name'
        ? BASE_LINE_HEIGHT * 1.2 // More space for surah header
        : BASE_LINE_HEIGHT * AYAH_LINE_SPACING; // Tighter for ayahs/basmallah
    currentY += lineHeight;
  }
  const totalContentHeight = currentY;

  const shouldCenterVertically = pageNumber === 1 || pageNumber === 2;

  // For pages 1-2: center content
  // For pages 3+: scale positions to fill entire page height
  const getY = (index: number) => {
    if (shouldCenterVertically) {
      return PAGE_PADDING_TOP + linePositions[index] + (CONTENT_HEIGHT - totalContentHeight) / 2;
    }
    // Scale to fill full page
    const scaleFactor = CONTENT_HEIGHT / totalContentHeight;
    return PAGE_PADDING_TOP + linePositions[index] * scaleFactor;
  };

  return (
    <View style={styles.page}>
      {lines.map((line, index) => {
        const y = getY(index);

        if (line.line_type === 'surah_name') {
          const headerTopOffset = BASE_LINE_HEIGHT * 0.15;
          const surahText =
            surahHeaderGlyphsMap[`surah-${line.surah_number}`] ??
            `سورة ${SURAH_NAMES[line.surah_number]}`;
          return (
            <Text
              key={`surah-${line.line_number}`}
              style={[
                styles.surahText,
                {
                  top: y + headerTopOffset,
                  color: SURAH_HEADER_COLOR,
                },
              ]}>
              {surahText}
            </Text>
          );
        }

        if (line.line_type === 'basmallah') {
          return (
            <SvgUri
              key={`basmallah-${line.line_number}`}
              uri={basmalahUri}
              preserveAspectRatio="xMidYMid meet"
              width={CONTENT_WIDTH}
              height={BASE_LINE_HEIGHT}
              style={[styles.basmallahSvg, {top: y}]}
            />
          );
        }

        // Ayah line - render word by word
        if (isIndopak) {
          const words: string[] = [];
          for (let i = line.first_word_id; i <= line.last_word_id; i++) {
            if (indopakWordsById[i]) {
              words.push(indopakWordsById[i]);
            }
          }

          const indopakCentered = line.is_centered === 1 || shouldCenterVertically;

          return (
            <View
              key={`line-${line.line_number}`}
              style={[
                styles.lineContainer,
                {
                  top: y,
                  justifyContent: indopakCentered ? 'center' : 'space-between',
                  gap: indopakCentered ? 8 : undefined,
                },
              ]}>
              {words.map((word, idx) => (
                <Text
                  key={idx}
                  allowFontScaling={false}
                  style={[
                    styles.indopakLineText,
                    {color: textColor},
                  ]}>
                  {word}
                </Text>
              ))}
            </View>
          );
        }

        const glyphs = showTajweed ? glyphsByIdTajweed : glyphsById;
        const words: string[] = [];
        for (let i = line.first_word_id; i <= line.last_word_id; i++) {
          if (glyphs[i]) {
            words.push(glyphs[i]);
          }
        }

        return (
          <View
            key={`line-${line.line_number}`}
            style={[
              styles.lineContainer,
              {
                top: y,
                justifyContent:
                  line.is_centered === 1 ? 'center' : 'space-between',
              },
            ]}>
            {words.map((glyph, idx) => (
              <Text
                key={idx}
                allowFontScaling={false}
                style={[
                  styles.wordText,
                  {
                    color: textColor,
                    fontFamily: showTajweed ? `p${pageNumber}_tajweed` : `p${pageNumber}`,
                  },
                ]}>
                {glyph}
              </Text>
            ))}
          </View>
        );
      })}

      <View style={styles.pageNumberContainer}>
        <Text style={[styles.pageNumber, {color: textColor}]}>
          {pageNumber}
        </Text>
      </View>
    </View>
  );
};

export default function MushafViewer({
  pageNumber: initialPage,
}: {
  pageNumber: number;
}) {
  const [layoutDb, setLayoutDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [basmalahLoaded, setBasmalahLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [surahSheetVisible, setSurahSheetVisible] = useState(false);
  const [indopakMappings, setIndopakMappings] = useState<{
    pageToSurah: Record<number, number>;
    surahStartPages: Record<number, number>;
  } | null>(null);
  const {theme} = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const showTajweed = useMushafSettingsStore(state => state.showTajweed);
  const arabicFontFamily = useMushafSettingsStore(state => state.arabicFontFamily);
  const isIndopak = arabicFontFamily === 'Indopak';
  const totalPages = isIndopak ? TOTAL_PAGES_INDOPAK : TOTAL_PAGES_QPC;

  const pages = useMemo(
    () => Array.from({length: totalPages}, (_, i) => i + 1),
    [totalPages],
  );

  const pageToSurah = isIndopak
    ? indopakMappings?.pageToSurah ?? {}
    : QPC_PAGE_TO_SURAH;
  const surahStartPages = isIndopak
    ? indopakMappings?.surahStartPages ?? {}
    : QPC_SURAH_START_PAGES;

  // Get current surah based on page
  const currentSurahId = pageToSurah[currentPage] || 1;
  const currentSurahName = SURAH_NAMES[currentSurahId];

  // Track visible page changes
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].item) {
        setCurrentPage(viewableItems[0].item);
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    [],
  );

  // Navigate to a surah
  const navigateToSurah = useCallback((surahId: number) => {
    const targetPage = surahStartPages[surahId];
    if (targetPage && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: targetPage - 1,
        animated: true,
      });
      setSurahSheetVisible(false);
    }
  }, [surahStartPages]);

  // Render surah item in bottom sheet
  const renderSurahItem = useCallback(
    ({item}: {item: (typeof SURAHS)[0]}) => {
      const isCurrentSurah = item.id === currentSurahId;
      return (
        <TouchableOpacity
          style={[
            styles.surahItem,
            isCurrentSurah && {backgroundColor: theme.colors.primary + '20'},
          ]}
          onPress={() => navigateToSurah(item.id)}>
          <View style={styles.surahNumberContainer}>
            <Text style={[styles.surahNumber, {color: theme.colors.text}]}>
              {item.id}
            </Text>
          </View>
          <View style={styles.surahInfo}>
            <Text style={[styles.surahNameArabic, {color: theme.colors.text}]}>
              {item.name_arabic}
            </Text>
            <Text
              style={[
                styles.surahNameEnglish,
                {color: theme.colors.text + '99'},
              ]}>
              {item.name}
            </Text>
          </View>
          <Text style={[styles.surahVerses, {color: theme.colors.text + '80'}]}>
            {item.verses_count} Ayat
          </Text>
        </TouchableOpacity>
      );
    },
    [currentSurahId, navigateToSurah, theme.colors],
  );




  useEffect(() => {
    let isActive = true;
    const initLayoutDb = async () => {
      try {
        setDbLoading(true);

        const dbName = isIndopak ? 'indopak_layout.db' : 'mushaf_layout.db';
        const assetId = isIndopak
          ? require('../../data/mushaf/indopak/qudratullah-indopak-15-lines.db')
          : require('../../data/mushaf/qpc-v2-15-lines.db');

        let db = await SQLite.openDatabaseAsync(dbName);

        // Check if the pages table exists
        const tableCheck = await db
          .getFirstAsync<{
            name: string;
          }>("SELECT name FROM sqlite_master WHERE type='table' AND name='pages';")
          .catch(() => null);

        if (!tableCheck) {
          // Database is empty or corrupted, reimport from assets
          await db.closeAsync();
          await SQLite.deleteDatabaseAsync(dbName);
          await SQLite.importDatabaseFromAssetAsync(dbName, {assetId});
          db = await SQLite.openDatabaseAsync(dbName);
        }

        if (!isActive) return;
        setLayoutDb(db);

        // Build surah mappings for indopak from the layout DB
        if (isIndopak) {
          const mappings = await buildIndopakSurahMappings(db);
          if (isActive) setIndopakMappings(mappings);
        }
      } catch (error) {
        console.error('Error initializing database:', error);
      } finally {
        if (isActive) setDbLoading(false);
      }
    };
    initLayoutDb();
    return () => {
      isActive = false;
    };
  }, [isIndopak]);

  useEffect(() => {
    let isActive = true;
    const loadBasmalah = async () => {
      try {
        await Asset.fromModule(BasmalahAsset).downloadAsync();
        if (isActive) setBasmalahLoaded(true);
      } catch (error) {
        console.error('Error preloading basmalah asset:', error);
        if (isActive) setBasmalahLoaded(true);
      }
    };
    loadBasmalah();
    return () => {
      isActive = false;
    };
  }, []);

  if (dbLoading || !basmalahLoaded) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* Header with surah name */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.surahSelector}
          onPress={() => setSurahSheetVisible(true)}>
          <Text style={[styles.headerSurahName, {color: theme.colors.text}]}>
            {currentSurahName}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.colors.text}
            style={styles.chevronIcon}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={({item}) => (
          <PageView
            pageNumber={item}
            layoutDb={layoutDb}
            textColor={theme.colors.text}
            showTajweed={isIndopak ? false : showTajweed}
            isIndopak={isIndopak}
          />
        )}
        keyExtractor={item => item.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(initialPage - 1, totalPages - 1)}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        inverted
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Surah selection bottom sheet */}
      <BottomSheetModal
        isVisible={surahSheetVisible}
        onClose={() => setSurahSheetVisible(false)}
        snapPoints={['70%']}>
        <Text style={[styles.sheetTitle, {color: theme.colors.text}]}>
          Select Surah
        </Text>
        <BottomSheetFlatList
          data={SURAHS}
          renderItem={renderSurahItem}
          keyExtractor={(item: {id: number}) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.max(0, currentSurahId - 3)}
          getItemLayout={(_: unknown, index: number) => ({
            length: 64,
            offset: 64 * index,
            index,
          })}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  surahSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSurahName: {
    fontSize: 18,
    fontFamily: 'Traditional-Arabic',
  },
  chevronIcon: {
    marginLeft: 4,
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  surahText: {
    position: 'absolute',
    fontSize: SURAH_HEADER_FONT_SIZE,
    fontFamily: 'SURAH_HEADERS',
    textAlign: 'center',
    width: CONTENT_WIDTH,
    left: PAGE_PADDING_HORIZONTAL,
    lineHeight: BASE_LINE_HEIGHT * 1.3,
  },
  basmallahText: {
    position: 'absolute',
    fontSize: QPC_FONT_SIZE,
    fontFamily: 'Traditional-Arabic',
    textAlign: 'center',
    width: SCREEN_WIDTH,
  },
  lineContainer: {
    position: 'absolute',
    flexDirection: 'row-reverse',
    width: CONTENT_WIDTH,
    left: PAGE_PADDING_HORIZONTAL,
    height: BASE_LINE_HEIGHT,
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  wordText: {
    fontSize: QPC_FONT_SIZE,
  },
  indopakLineText: {
    fontFamily: 'Indopak',
    fontSize: INDOPAK_FONT_SIZE,
  },
  pageNumberContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pageNumber: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 64,
  },
  surahNumberContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  surahNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  surahInfo: {
    flex: 1,
  },
  surahNameArabic: {
    fontSize: 18,
    fontFamily: 'Traditional-Arabic',
    textAlign: 'left',
  },
  surahNameEnglish: {
    fontSize: 12,
    marginTop: 2,
  },
  basmallahSvg: {
    position: 'absolute',
    left: PAGE_PADDING_HORIZONTAL,
    width: CONTENT_WIDTH,
    height: BASE_LINE_HEIGHT,
  },
  surahVerses: {
    fontSize: 12,
  },
});
