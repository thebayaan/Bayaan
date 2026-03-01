/**
 * MushafPlayerOptionsSheet - Comprehensive playback settings
 *
 * Consolidates reciter selection, verse range, speed, repeat counts,
 * quick-select shortcuts, and a "Play Audio" CTA into a single sheet.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
} from 'react-native';
import {ScaledSheet, moderateScale as ms} from 'react-native-size-matters';
import {Feather, Ionicons} from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
} from 'react-native-actions-sheet';
import {
  useMushafPlayerStore,
  AvailableReciter,
} from '@/store/mushafPlayerStore';
import {SURAHS} from '@/data/surahData';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import Color from 'color';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const VERSE_REPEAT_OPTIONS = [
  {label: '1 time', value: 1},
  {label: '2 times', value: 2},
  {label: '3 times', value: 3},
  {label: 'Loop', value: 0},
];

const RANGE_REPEAT_OPTIONS = [
  {label: '1 time', value: 1},
  {label: '2 times', value: 2},
  {label: '3 times', value: 3},
  {label: 'Loop', value: 0},
];

type AccordionSection = 'startVerse' | 'endVerse' | 'reciter' | null;
type VersePick = 'surahList' | 'ayahGrid';

// ---------------------------------------------------------------------------
// Helper: format verse key to display string
// ---------------------------------------------------------------------------
function formatVerseKey(verseKey: string): string {
  const [s, a] = verseKey.split(':').map(Number);
  if (s < 1 || s > 114) return verseKey;
  return `${SURAHS[s - 1].name} ${s}:${a}`;
}

// ---------------------------------------------------------------------------
// Accordion Chevron
// ---------------------------------------------------------------------------
const AnimatedChevron: React.FC<{expanded: boolean; color: string}> = ({
  expanded,
  color,
}) => {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, {duration: 200});
  }, [expanded, rotation]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}],
  }));
  return (
    <Animated.View style={animStyle}>
      <Ionicons name="chevron-down" size={ms(16)} color={color} />
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// FadedScrollList — fixed-height scrollable area with bottom fade
// ---------------------------------------------------------------------------
const ACCORDION_MAX_HEIGHT = ms(240);

const AccordionScrollList: React.FC<{children: React.ReactNode}> = ({
  children,
}) => (
  <RNScrollView
    style={{maxHeight: ACCORDION_MAX_HEIGHT}}
    nestedScrollEnabled
    showsVerticalScrollIndicator={false}
    bounces={false}>
    {children}
  </RNScrollView>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MushafPlayerOptionsSheet = (
  props: SheetProps<'mushaf-player-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const currentPage = props.payload?.currentPage ?? 1;

  // Store selectors
  const storeRewayatId = useMushafPlayerStore(s => s.rewayatId);
  const storeReciterName = useMushafPlayerStore(s => s.reciterName);
  const storeRate = useMushafPlayerStore(s => s.rate);
  const storeVerseRepeat = useMushafPlayerStore(s => s.verseRepeatCount);
  const storeRangeRepeat = useMushafPlayerStore(s => s.rangeRepeatCount);
  const availableReciters = useMushafPlayerStore(s => s.availableReciters);

  // Compute defaults for this page, falling back to store range if available
  const storeRangeStart = useMushafPlayerStore(s => s.rangeStart);
  const storeRangeEnd = useMushafPlayerStore(s => s.rangeEnd);
  const pageVerseKeys = useMemo(
    () => mushafVerseMapService.getOrderedVerseKeysForPage(currentPage),
    [currentPage],
  );
  const defaultStart = storeRangeStart
    ? `${storeRangeStart.surah}:${storeRangeStart.ayah}`
    : pageVerseKeys[0] ?? '1:1';
  const defaultEnd = storeRangeEnd
    ? `${storeRangeEnd.surah}:${storeRangeEnd.ayah}`
    : pageVerseKeys[pageVerseKeys.length - 1] ?? '1:7';

  // Local state — applied only on "Play Audio"
  const [startVerseKey, setStartVerseKey] = useState(defaultStart);
  const [endVerseKey, setEndVerseKey] = useState(defaultEnd);
  const [selectedRewayatId, setSelectedRewayatId] = useState<string | null>(
    storeRewayatId,
  );
  const [selectedReciterName, setSelectedReciterName] = useState<string | null>(
    storeReciterName,
  );
  const [rate, setRate] = useState(storeRate);
  const [verseRepeat, setVerseRepeat] = useState(storeVerseRepeat);
  const [rangeRepeat, setRangeRepeat] = useState(storeRangeRepeat);

  // Accordion
  const [expandedSection, setExpandedSection] =
    useState<AccordionSection>(null);

  // Verse picker sub-state
  const [startPickStep, setStartPickStep] = useState<VersePick>('surahList');
  const [endPickStep, setEndPickStep] = useState<VersePick>('surahList');
  const [startPickSurah, setStartPickSurah] = useState<number | null>(null);
  const [endPickSurah, setEndPickSurah] = useState<number | null>(null);

  // Pre-populate from pending start verse if set
  useEffect(() => {
    const pending = useMushafPlayerStore.getState().pendingStartVerseKey;
    if (pending) {
      setStartVerseKey(pending);
    }
  }, []);

  // Compute reciters on mount
  useEffect(() => {
    if (availableReciters.length === 0) {
      useMushafPlayerStore.getState().computeAvailableReciters();
    }
  }, [availableReciters.length]);

  // Apply rate change immediately for live preview
  const handleRateChange = useCallback((newRate: number) => {
    setRate(newRate);
    useMushafPlayerStore.getState().setRate(newRate);
  }, []);

  const toggleSection = useCallback(
    (section: AccordionSection) => {
      setExpandedSection(prev => {
        if (prev === section) return null;
        // Pre-select the already-chosen surah so the picker opens to the ayah grid
        if (section === 'startVerse') {
          const [s] = startVerseKey.split(':').map(Number);
          if (s >= 1 && s <= 114) {
            setStartPickSurah(s);
            setStartPickStep('ayahGrid');
          } else {
            setStartPickStep('surahList');
            setStartPickSurah(null);
          }
        }
        if (section === 'endVerse') {
          const [s] = endVerseKey.split(':').map(Number);
          if (s >= 1 && s <= 114) {
            setEndPickSurah(s);
            setEndPickStep('ayahGrid');
          } else {
            setEndPickStep('surahList');
            setEndPickSurah(null);
          }
        }
        return section;
      });
    },
    [startVerseKey, endVerseKey],
  );

  // Handle surah selection in verse picker
  const handleStartSurahPick = useCallback((surahId: number) => {
    setStartPickSurah(surahId);
    setStartPickStep('ayahGrid');
  }, []);

  const handleEndSurahPick = useCallback((surahId: number) => {
    setEndPickSurah(surahId);
    setEndPickStep('ayahGrid');
  }, []);

  const handleStartAyahPick = useCallback(
    (ayah: number) => {
      if (!startPickSurah) return;
      setStartVerseKey(`${startPickSurah}:${ayah}`);
      setExpandedSection(null);
    },
    [startPickSurah],
  );

  const handleEndAyahPick = useCallback(
    (ayah: number) => {
      if (!endPickSurah) return;
      setEndVerseKey(`${endPickSurah}:${ayah}`);
      setExpandedSection(null);
    },
    [endPickSurah],
  );

  // Reciter selection
  const handleReciterSelect = useCallback((reciter: AvailableReciter) => {
    setSelectedRewayatId(reciter.rewayatId);
    setSelectedReciterName(reciter.reciterName);
    setExpandedSection(null);
  }, []);

  // Play Audio
  const canPlay = !!selectedRewayatId;

  const handlePlayAudio = useCallback(() => {
    if (!selectedRewayatId || !selectedReciterName) return;

    const store = useMushafPlayerStore.getState();
    store.stop();

    // Apply settings
    store.setReciter(selectedRewayatId, selectedReciterName);

    const [startS, startA] = startVerseKey.split(':').map(Number);
    const [endS, endA] = endVerseKey.split(':').map(Number);
    store.setRange({surah: startS, ayah: startA}, {surah: endS, ayah: endA});

    store.setRate(rate);
    store.setVerseRepeatCount(verseRepeat);
    store.setRangeRepeatCount(rangeRepeat);

    store.startPlayback(currentPage, startVerseKey);
    SheetManager.hide('mushaf-player-options');
  }, [
    selectedRewayatId,
    selectedReciterName,
    startVerseKey,
    endVerseKey,
    rate,
    verseRepeat,
    rangeRepeat,
    currentPage,
  ]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderSurahList = (onSelect: (surahId: number) => void) => (
    <View>
      {SURAHS.map(item => (
        <Pressable
          key={item.id}
          style={({pressed}) => [
            styles.pickerRow,
            pressed && styles.pickerRowPressed,
          ]}
          onPress={() => onSelect(item.id)}>
          <Text style={styles.pickerRowNumber}>{item.id}</Text>
          <Text style={styles.pickerRowText}>{item.name}</Text>
          <Ionicons
            name="chevron-forward"
            size={ms(14)}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      ))}
    </View>
  );

  const renderAyahGrid = (
    surahId: number,
    onSelect: (ayah: number) => void,
    onBack: () => void,
  ) => {
    const versesCount = SURAHS[surahId - 1]?.verses_count ?? 1;
    const ayahs = Array.from({length: versesCount}, (_, i) => i + 1);
    return (
      <View>
        <Pressable style={styles.pickerBackRow} onPress={onBack}>
          <Ionicons
            name="chevron-back"
            size={ms(16)}
            color={theme.colors.text}
          />
          <Text style={styles.pickerBackText}>{SURAHS[surahId - 1].name}</Text>
        </Pressable>
        <View style={styles.ayahGrid}>
          {ayahs.map(a => (
            <Pressable
              key={a}
              style={({pressed}) => [
                styles.ayahChip,
                pressed && styles.ayahChipPressed,
              ]}
              onPress={() => onSelect(a)}>
              <Text style={styles.ayahChipText}>{a}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {/* Title */}
        <Text style={styles.title}>Playback Settings</Text>

        {/* ============================================================== */}
        {/* Select Range                                                   */}
        {/* ============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Range</Text>

          {/* Starting Verse */}
          <Pressable
            style={({pressed}) => [
              styles.dropdownRow,
              pressed && styles.dropdownRowPressed,
            ]}
            onPress={() => toggleSection('startVerse')}>
            <Text style={styles.dropdownLabel}>Starting Verse</Text>
            <Text style={styles.dropdownValue} numberOfLines={1}>
              {formatVerseKey(startVerseKey)}
            </Text>
            <AnimatedChevron
              expanded={expandedSection === 'startVerse'}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          {expandedSection === 'startVerse' && (
            <View style={styles.accordionContent}>
              <AccordionScrollList>
                {startPickStep === 'surahList'
                  ? renderSurahList(handleStartSurahPick)
                  : startPickSurah
                  ? renderAyahGrid(startPickSurah, handleStartAyahPick, () =>
                      setStartPickStep('surahList'),
                    )
                  : null}
              </AccordionScrollList>
            </View>
          )}

          {/* Ending Verse */}
          <Pressable
            style={({pressed}) => [
              styles.dropdownRow,
              pressed && styles.dropdownRowPressed,
            ]}
            onPress={() => toggleSection('endVerse')}>
            <Text style={styles.dropdownLabel}>Ending Verse</Text>
            <Text style={styles.dropdownValue} numberOfLines={1}>
              {formatVerseKey(endVerseKey)}
            </Text>
            <AnimatedChevron
              expanded={expandedSection === 'endVerse'}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          {expandedSection === 'endVerse' && (
            <View style={styles.accordionContent}>
              <AccordionScrollList>
                {endPickStep === 'surahList'
                  ? renderSurahList(handleEndSurahPick)
                  : endPickSurah
                  ? renderAyahGrid(endPickSurah, handleEndAyahPick, () =>
                      setEndPickStep('surahList'),
                    )
                  : null}
              </AccordionScrollList>
            </View>
          )}
        </View>

        {/* ============================================================== */}
        {/* Reciter                                                        */}
        {/* ============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reciter</Text>
          <Pressable
            style={({pressed}) => [
              styles.dropdownRow,
              pressed && styles.dropdownRowPressed,
            ]}
            onPress={() => toggleSection('reciter')}>
            <Text
              style={[styles.dropdownValue, {textAlign: 'left'}]}
              numberOfLines={1}>
              {selectedReciterName || 'Select Reciter'}
            </Text>
            <AnimatedChevron
              expanded={expandedSection === 'reciter'}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          {expandedSection === 'reciter' && (
            <View style={styles.accordionContent}>
              <AccordionScrollList>
                <View>
                  {availableReciters.map(item => {
                    const isSelected = item.rewayatId === selectedRewayatId;
                    return (
                      <Pressable
                        key={item.rewayatId}
                        style={({pressed}) => [
                          styles.reciterRow,
                          isSelected && styles.reciterRowSelected,
                          pressed && styles.pickerRowPressed,
                        ]}
                        onPress={() => handleReciterSelect(item)}>
                        <View style={styles.reciterInfo}>
                          <Text style={styles.reciterName} numberOfLines={1}>
                            {item.reciterName}
                          </Text>
                          <Text style={styles.reciterStyle} numberOfLines={1}>
                            {item.style}
                          </Text>
                        </View>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={ms(16)}
                            color={theme.colors.text}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </AccordionScrollList>
            </View>
          )}
        </View>

        {/* ============================================================== */}
        {/* Play speed                                                     */}
        {/* ============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play speed</Text>
          <View style={styles.chipRowFlex}>
            {SPEEDS.map(speed => {
              const isActive = rate === speed;
              return (
                <Pressable
                  key={speed}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => handleRateChange(speed)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {speed}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ============================================================== */}
        {/* Play each verse                                                */}
        {/* ============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play each verse</Text>
          <View style={styles.chipRowFlex}>
            {VERSE_REPEAT_OPTIONS.map(opt => {
              const isActive = verseRepeat === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => setVerseRepeat(opt.value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ============================================================== */}
        {/* Play the range                                                 */}
        {/* ============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play the range</Text>
          <View style={styles.chipRowFlex}>
            {RANGE_REPEAT_OPTIONS.map(opt => {
              const isActive = rangeRepeat === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => setRangeRepeat(opt.value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Play Audio CTA — pinned outside scroll */}
      <View
        style={[styles.stickyFooter, {paddingBottom: insets.bottom + ms(4)}]}>
        <Pressable
          style={[styles.playButton, !canPlay && styles.playButtonDisabled]}
          onPress={handlePlayAudio}
          disabled={!canPlay}>
          <Ionicons
            name="play"
            size={ms(18)}
            color={
              canPlay
                ? theme.colors.background
                : Color(theme.colors.text).alpha(0.3).toString()
            }
          />
          <Text
            style={[
              styles.playButtonText,
              !canPlay && styles.playButtonTextDisabled,
            ]}>
            Play
          </Text>
        </Pressable>
      </View>
    </ActionSheet>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: ms(20),
      borderTopRightRadius: ms(20),
      paddingTop: ms(8),
      maxHeight: '85%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: ms(40),
      height: 2.5,
    },
    scrollView: {
      flexGrow: 0,
    },
    container: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
    },

    // Title
    title: {
      fontSize: ms(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: ms(20),
    },

    // Sections
    section: {
      marginBottom: ms(20),
    },
    sectionLabel: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      marginBottom: ms(10),
    },

    // Dropdown rows
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(14),
      paddingHorizontal: ms(16),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: ms(12),
      marginBottom: ms(8),
    },
    dropdownRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    dropdownLabel: {
      fontSize: ms(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginRight: ms(8),
    },
    dropdownValue: {
      flex: 1,
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'right',
      marginRight: ms(8),
    },

    // Accordion content
    accordionContent: {
      backgroundColor: Color(theme.colors.text).alpha(0.03).toString(),
      borderRadius: ms(12),
      marginBottom: ms(8),
      overflow: 'hidden',
    },

    // Verse picker rows
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(12),
      paddingHorizontal: ms(16),
    },
    pickerRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    pickerRowNumber: {
      width: ms(32),
      fontSize: ms(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    pickerRowText: {
      flex: 1,
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },

    // Verse picker back button + ayah grid
    pickerBackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      gap: ms(4),
    },
    pickerBackText: {
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    ayahGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: ms(12),
      paddingBottom: ms(12),
      gap: ms(8),
    },
    ayahChip: {
      width: ms(36),
      height: ms(36),
      borderRadius: ms(8),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    ayahChipPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    ayahChipText: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },

    // Reciter picker rows
    reciterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(12),
      paddingHorizontal: ms(16),
      borderRadius: ms(8),
    },
    reciterRowSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    reciterInfo: {
      flex: 1,
      gap: ms(2),
    },
    reciterName: {
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    reciterStyle: {
      fontSize: ms(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },

    // Chips (wrap)
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ms(8),
    },
    chip: {
      paddingVertical: ms(8),
      paddingHorizontal: ms(16),
      borderRadius: ms(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    chipActive: {
      backgroundColor: theme.colors.text,
    },
    chipText: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    chipTextActive: {
      color: theme.colors.background,
    },

    // Chips (flex: 1 row)
    chipRowFlex: {
      flexDirection: 'row',
      gap: ms(8),
    },
    chipFlex: {
      flex: 1,
      paddingVertical: ms(8),
      borderRadius: ms(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      alignItems: 'center',
    },

    // Sticky footer
    stickyFooter: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.1).toString(),
    },

    // Play Audio button
    playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ms(52),
      borderRadius: ms(14),
      backgroundColor: theme.colors.text,
      gap: ms(8),
    },
    playButtonDisabled: {
      backgroundColor: Color(theme.colors.text).alpha(0.15).toString(),
    },
    playButtonText: {
      fontSize: ms(16),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.background,
    },
    playButtonTextDisabled: {
      color: Color(theme.colors.text).alpha(0.3).toString(),
    },
  });
