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
import surahHeaderGlyphs from '@/data/mushaf/legacy/SURAH_HEADERS.json' with {type: 'json'};
const surahHeaderGlyphsMap = surahHeaderGlyphs as Record<string, string>;
import {SvgUri} from 'react-native-svg';
import {Asset} from 'expo-asset';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {SURAH_NAMES} from './constants';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import SkiaPage from './skia/SkiaPage';

// SVG asset for basmallah (used by Indopak path)
const BasmalahAsset = require('@/data/mushaf/legacy/Bismillah..svg');
const basmalahUri = Asset.fromModule(BasmalahAsset).uri;

// Surah header font (shared between Uthmani and Indopak)
const surahHeaderFont = require('@/data/mushaf/legacy/SURAH_HEADERS.ttf');
let isSurahHeaderFontLoaded = false;

let isIndopakFontLoaded = false;

async function loadIndopakFont(): Promise<boolean> {
  if (isIndopakFontLoaded) return true;
  try {
    await Font.loadAsync({
      Indopak: require('@/data/mushaf/legacy/indopak/font.ttf'),
    });
    isIndopakFontLoaded = true;
    return true;
  } catch (error) {
    console.error('Error loading indopak font:', error);
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
const TOTAL_PAGES_UTHMANI = 604;
const TOTAL_PAGES_INDOPAK = 610;
const LINES_PER_PAGE = 15;

const IS_COMPACT_DEVICE = SCREEN_HEIGHT < 700;

const PAGE_PADDING_HORIZONTAL = IS_COMPACT_DEVICE ? 8 : 16;
const PAGE_PADDING_TOP = IS_COMPACT_DEVICE ? 30 : 110;
const PAGE_PADDING_BOTTOM = IS_COMPACT_DEVICE ? 70 : 130;
const AYAH_LINE_SPACING = IS_COMPACT_DEVICE ? 0.75 : 0.7;

const CONTENT_WIDTH = SCREEN_WIDTH - PAGE_PADDING_HORIZONTAL * 2;
const CONTENT_HEIGHT = SCREEN_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
const BASE_LINE_HEIGHT = CONTENT_HEIGHT / LINES_PER_PAGE;

const REFERENCE_WIDTH = 400;
const REFERENCE_FONT_SIZE = 24;
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 56;

const widthScale = SCREEN_WIDTH / REFERENCE_WIDTH;
const maxFontFromHeight =
  (CONTENT_HEIGHT / LINES_PER_PAGE) * AYAH_LINE_SPACING * 0.85;

const INDOPAK_FONT_SIZE_RATIO = IS_COMPACT_DEVICE ? 0.85 : 0.95;
const INDOPAK_FONT_SIZE = Math.max(
  MIN_FONT_SIZE,
  Math.min(
    Math.round(REFERENCE_FONT_SIZE * widthScale * INDOPAK_FONT_SIZE_RATIO),
    maxFontFromHeight,
    MAX_FONT_SIZE,
  ),
);

const SURAH_HEADER_FONT_SIZE = CONTENT_WIDTH * 0.25;
const SURAH_HEADER_COLOR = '#5D4037';

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
        .getFirstAsync<{
          name: string;
        }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='words';",
        )
        .catch(() => null);

      if (!tableCheck) {
        await db.closeAsync();
        await SQLite.deleteDatabaseAsync('indopak_words.db');
        await SQLite.importDatabaseFromAssetAsync('indopak_words.db', {
          assetId: require('../../data/mushaf/legacy/indopak/indopak-nastaleeq.db'),
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

// Build indopak surah mappings from layout DB
async function buildIndopakSurahMappings(db: SQLite.SQLiteDatabase): Promise<{
  pageToSurah: Record<number, number>;
  surahStartPages: Record<number, number>;
}> {
  const pageToSurah: Record<number, number> = {};
  const surahStartPages: Record<number, number> = {};

  const rows = await db.getAllAsync<{
    page_number: number;
    surah_number: number;
  }>(
    "SELECT page_number, surah_number FROM pages WHERE line_type='surah_name' ORDER BY page_number;",
  );

  for (const row of rows) {
    if (!surahStartPages[row.surah_number]) {
      surahStartPages[row.surah_number] = row.page_number;
    }
  }

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

// ============================================================================
// Uthmani PageView (Skia-based via DigitalKhatt)
// ============================================================================
const UthmaniPageView: React.FC<{
  pageNumber: number;
  textColor: string;
}> = ({pageNumber, textColor}) => {
  const [surahHeaderFontLoaded, setSurahHeaderFontLoaded] = useState(
    isSurahHeaderFontLoaded,
  );

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const success = await loadSurahHeaderFont();
      if (isActive) setSurahHeaderFontLoaded(success);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  // Get page lines from DigitalKhattDataService for surah header overlays
  const pageLines = useMemo(
    () => digitalKhattDataService.getPageLines(pageNumber),
    [pageNumber],
  );

  const shouldCenterVertically = pageNumber === 1 || pageNumber === 2;

  // Calculate Y positions for surah header overlays
  const interLine = CONTENT_HEIGHT / pageLines.length;

  return (
    <View style={styles.page}>
      {/* Skia Canvas renders ayah + basmallah lines */}
      <SkiaPage pageNumber={pageNumber} textColor={textColor} />

      {/* Surah header overlays (rendered as RN Text for the glyph font) */}
      {surahHeaderFontLoaded &&
        pageLines.map((line, index) => {
          if (line.line_type !== 'surah_name') return null;

          const yPos = PAGE_PADDING_TOP + index * interLine;
          const headerTopOffset = BASE_LINE_HEIGHT * 0.15;

          const surahText =
            surahHeaderGlyphsMap[`surah-${line.surah_number}`] ??
            `سورة ${SURAH_NAMES[line.surah_number]}`;

          return (
            <Text
              key={`surah-${pageNumber}-${line.line_number}`}
              style={[
                styles.surahText,
                {
                  top: yPos + headerTopOffset,
                  color: SURAH_HEADER_COLOR,
                },
              ]}>
              {surahText}
            </Text>
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

// ============================================================================
// Indopak PageView (kept as-is with React Native Text)
// ============================================================================
const IndopakPageView: React.FC<{
  pageNumber: number;
  layoutDb: SQLite.SQLiteDatabase | null;
  textColor: string;
}> = ({pageNumber, layoutDb, textColor}) => {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(indopakWordsLoaded);
  const [surahHeaderFontLoaded, setSurahHeaderFontLoaded] = useState(
    isSurahHeaderFontLoaded,
  );

  useEffect(() => {
    let isActive = true;
    const loadFont = async () => {
      const success = await loadIndopakFont();
      await loadIndopakWords();
      if (isActive) setFontLoaded(success && indopakWordsLoaded);
    };
    loadFont();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadFont = async () => {
      const success = await loadSurahHeaderFont();
      if (isActive) setSurahHeaderFontLoaded(success);
    };
    loadFont();
    return () => {
      isActive = false;
    };
  }, []);

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

  const linePositions: number[] = [];
  let currentY = 0;
  for (let i = 0; i < lines.length; i++) {
    linePositions.push(currentY);
    const lineHeight =
      lines[i].line_type === 'surah_name'
        ? BASE_LINE_HEIGHT * 1.2
        : BASE_LINE_HEIGHT * AYAH_LINE_SPACING;
    currentY += lineHeight;
  }
  const totalContentHeight = currentY;
  const shouldCenterVertically = pageNumber === 1 || pageNumber === 2;

  const getY = (index: number) => {
    if (shouldCenterVertically) {
      return (
        PAGE_PADDING_TOP +
        linePositions[index] +
        (CONTENT_HEIGHT - totalContentHeight) / 2
      );
    }
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

        const words: string[] = [];
        for (let i = line.first_word_id; i <= line.last_word_id; i++) {
          if (indopakWordsById[i]) {
            words.push(indopakWordsById[i]);
          }
        }

        const indopakCentered =
          line.is_centered === 1 || shouldCenterVertically;

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
                style={[styles.indopakLineText, {color: textColor}]}>
                {word}
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

// ============================================================================
// MushafViewer (main exported component)
// ============================================================================
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
  const [dkDataReady, setDkDataReady] = useState(
    digitalKhattDataService.initialized,
  );
  const {theme} = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const arabicFontFamily = useMushafSettingsStore(
    state => state.arabicFontFamily,
  );
  const isIndopak = arabicFontFamily === 'Indopak';
  const isUthmani = !isIndopak;
  const totalPages = isIndopak ? TOTAL_PAGES_INDOPAK : TOTAL_PAGES_UTHMANI;

  const pages = useMemo(
    () => Array.from({length: totalPages}, (_, i) => i + 1),
    [totalPages],
  );

  // Initialize DigitalKhatt data for Uthmani mode
  useEffect(() => {
    if (!isUthmani) return;
    if (digitalKhattDataService.initialized) {
      setDkDataReady(true);
      return;
    }
    let isActive = true;
    const init = async () => {
      try {
        await digitalKhattDataService.initialize();
        if (isActive) setDkDataReady(true);
      } catch (error) {
        console.error('Error initializing DigitalKhatt data:', error);
      }
    };
    init();
    return () => {
      isActive = false;
    };
  }, [isUthmani]);

  // Surah mappings: for Uthmani use DigitalKhattDataService, for Indopak use layout DB
  const uthmaniPageToSurah = dkDataReady
    ? digitalKhattDataService.getPageToSurah()
    : {};
  const uthmaniSurahStartPages = dkDataReady
    ? digitalKhattDataService.getSurahStartPages()
    : {};

  const pageToSurah = isIndopak
    ? (indopakMappings?.pageToSurah ?? {})
    : uthmaniPageToSurah;
  const surahStartPages = isIndopak
    ? (indopakMappings?.surahStartPages ?? {})
    : uthmaniSurahStartPages;

  const currentSurahId = pageToSurah[currentPage] || 1;
  const currentSurahName = SURAH_NAMES[currentSurahId];

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

  const navigateToSurah = useCallback(
    (surahId: number) => {
      const targetPage = surahStartPages[surahId];
      if (targetPage && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: targetPage - 1,
          animated: true,
        });
        setSurahSheetVisible(false);
      }
    },
    [surahStartPages],
  );

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

  // Initialize Indopak layout DB (only when Indopak selected)
  useEffect(() => {
    if (!isIndopak) {
      setDbLoading(false);
      return;
    }
    let isActive = true;
    const initLayoutDb = async () => {
      try {
        setDbLoading(true);
        const dbName = 'indopak_layout.db';
        const assetId = require('../../data/mushaf/legacy/indopak/qudratullah-indopak-15-lines.db');

        let db = await SQLite.openDatabaseAsync(dbName);
        const tableCheck = await db
          .getFirstAsync<{
            name: string;
          }>("SELECT name FROM sqlite_master WHERE type='table' AND name='pages';")
          .catch(() => null);

        if (!tableCheck) {
          await db.closeAsync();
          await SQLite.deleteDatabaseAsync(dbName);
          await SQLite.importDatabaseFromAssetAsync(dbName, {assetId});
          db = await SQLite.openDatabaseAsync(dbName);
        }

        if (!isActive) return;
        setLayoutDb(db);

        const mappings = await buildIndopakSurahMappings(db);
        if (isActive) setIndopakMappings(mappings);
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

  // Preload basmalah SVG asset (used by Indopak)
  useEffect(() => {
    if (!isIndopak) {
      setBasmalahLoaded(true);
      return;
    }
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
  }, [isIndopak]);

  // Show loading if dependencies not ready
  const isLoading = isIndopak ? dbLoading || !basmalahLoaded : !dkDataReady;

  if (isLoading) {
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
        renderItem={({item}) =>
          isIndopak ? (
            <IndopakPageView
              pageNumber={item}
              layoutDb={layoutDb}
              textColor={theme.colors.text}
            />
          ) : (
            <UthmaniPageView pageNumber={item} textColor={theme.colors.text} />
          )
        }
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
  lineContainer: {
    position: 'absolute',
    flexDirection: 'row-reverse',
    width: CONTENT_WIDTH,
    left: PAGE_PADDING_HORIZONTAL,
    height: BASE_LINE_HEIGHT,
    alignItems: 'flex-start',
    overflow: 'visible',
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
