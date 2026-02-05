import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  Dimensions,
} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
} from 'react-native-actions-sheet';
import Color from 'color';
import {Icon} from '@rneui/themed';
import {useUploadsStore} from '@/store/uploadsStore';
import {
  searchSurahs,
  getSurahById,
  getReciterName,
} from '@/services/dataService';
import {RECITERS} from '@/data/reciterData';
import type {Surah} from '@/data/surahData';
import type {UploadedRecitation} from '@/types/uploads';
import {
  DEFAULT_REWAYAH,
  DEFAULT_STYLE,
  REWAYAH_OPTIONS,
  STYLE_OPTIONS,
} from '@/constants/recitationOptions';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type RecitationType = 'surah' | 'other';

const CATEGORY_OPTIONS: {
  id: UploadedRecitation['category'];
  label: string;
}[] = [
  {id: 'dua', label: "Du'a"},
  {id: 'lecture', label: 'Lecture'},
  {id: 'tafsir', label: 'Tafsir'},
  {id: 'other', label: 'Other'},
];

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'Unknown duration';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const OrganizeRecitationSheet = (
  props: SheetProps<'organize-recitation'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const {updateTags, deleteRecitation, customReciters, createCustomReciter} =
    useUploadsStore();

  const payload = props.payload;
  const recitation = payload?.recitation;

  // Local state for tag fields
  const [type, setType] = useState<RecitationType | null>(
    recitation?.type ?? null,
  );
  const [surahNumber, setSurahNumber] = useState<number | null>(
    recitation?.surahNumber ?? null,
  );
  const [startVerse, setStartVerse] = useState<number | null>(
    recitation?.startVerse ?? null,
  );
  const [endVerse, setEndVerse] = useState<number | null>(
    recitation?.endVerse ?? null,
  );
  const [title, setTitle] = useState<string>(recitation?.title ?? '');
  const [category, setCategory] = useState<UploadedRecitation['category']>(
    recitation?.category ?? null,
  );
  const [reciterId, setReciterId] = useState<string | null>(
    recitation?.reciterId ?? null,
  );
  const [customReciterId, setCustomReciterId] = useState<string | null>(
    recitation?.customReciterId ?? null,
  );
  const [reciterDisplayName, setReciterDisplayName] = useState<string>(() => {
    if (recitation?.reciterId) {
      return getReciterName(recitation.reciterId) ?? '';
    }
    if (recitation?.customReciterId) {
      const cr = customReciters.find(r => r.id === recitation.customReciterId);
      return cr?.name ?? '';
    }
    return '';
  });
  const [rewayah, setRewayah] = useState<string>(
    recitation?.rewayah || DEFAULT_REWAYAH,
  );
  const [style, setStyle] = useState<string>(
    recitation?.style || DEFAULT_STYLE,
  );
  const [showMoreOptions, setShowMoreOptions] = useState(
    () =>
      (recitation?.rewayah !== null &&
        recitation?.rewayah !== DEFAULT_REWAYAH) ||
      (recitation?.style !== null && recitation?.style !== DEFAULT_STYLE),
  );

  // Sync state when the sheet reopens with a different/updated recitation
  useEffect(() => {
    if (!recitation) return;
    setType(recitation.type ?? null);
    setSurahNumber(recitation.surahNumber ?? null);
    setStartVerse(recitation.startVerse ?? null);
    setEndVerse(recitation.endVerse ?? null);
    setTitle(recitation.title ?? '');
    setCategory(recitation.category ?? null);
    setReciterId(recitation.reciterId ?? null);
    setCustomReciterId(recitation.customReciterId ?? null);
    setRewayah(recitation.rewayah || DEFAULT_REWAYAH);
    setStyle(recitation.style || DEFAULT_STYLE);
    setShowMoreOptions(
      (recitation.rewayah !== null && recitation.rewayah !== DEFAULT_REWAYAH) ||
        (recitation.style !== null && recitation.style !== DEFAULT_STYLE),
    );
    // Reset search state
    setSurahQuery('');
    setShowSurahResults(false);
    setReciterQuery('');
    setShowReciterResults(false);
    // Resolve reciter display name
    if (recitation.reciterId) {
      setReciterDisplayName(getReciterName(recitation.reciterId) ?? '');
    } else if (recitation.customReciterId) {
      const cr = customReciters.find(r => r.id === recitation.customReciterId);
      setReciterDisplayName(cr?.name ?? '');
    } else {
      setReciterDisplayName('');
    }
  }, [
    recitation?.id,
    recitation?.type,
    recitation?.rewayah,
    recitation?.style,
  ]);

  const hasChanges = useMemo(() => {
    if (!recitation) return false;
    return (
      type !== recitation.type ||
      surahNumber !== recitation.surahNumber ||
      startVerse !== recitation.startVerse ||
      endVerse !== recitation.endVerse ||
      title !== (recitation.title ?? '') ||
      category !== recitation.category ||
      reciterId !== recitation.reciterId ||
      customReciterId !== recitation.customReciterId ||
      rewayah !== (recitation.rewayah || DEFAULT_REWAYAH) ||
      style !== (recitation.style || DEFAULT_STYLE)
    );
  }, [
    recitation,
    type,
    surahNumber,
    startVerse,
    endVerse,
    title,
    category,
    reciterId,
    customReciterId,
    rewayah,
    style,
  ]);

  const handleSave = useCallback(async () => {
    if (!recitation || !hasChanges) return;
    Keyboard.dismiss();
    await updateTags(recitation.id, {
      type,
      surahNumber: type === 'surah' ? surahNumber : null,
      startVerse: type === 'surah' ? startVerse : null,
      endVerse: type === 'surah' ? endVerse : null,
      title: type === 'other' ? title || null : null,
      category: type === 'other' ? category : null,
      reciterId,
      customReciterId,
      rewayah: rewayah || null,
      style: style || null,
    });
    await SheetManager.hide('organize-recitation');
  }, [
    recitation,
    hasChanges,
    updateTags,
    type,
    surahNumber,
    startVerse,
    endVerse,
    title,
    category,
    reciterId,
    customReciterId,
    rewayah,
    style,
  ]);

  const handleDelete = useCallback(async () => {
    if (!recitation) return;
    Keyboard.dismiss();
    await deleteRecitation(recitation.id);
    await SheetManager.hide('organize-recitation');
  }, [recitation, deleteRecitation]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    SheetManager.hide('organize-recitation');
  }, []);

  const handleTypeSelect = useCallback((newType: RecitationType) => {
    setType(prev => (prev === newType ? null : newType));
  }, []);

  // Surah search
  const [surahQuery, setSurahQuery] = useState('');
  const [showSurahResults, setShowSurahResults] = useState(false);

  const surahResults = useMemo(() => {
    if (!surahQuery.trim()) return [];
    return searchSurahs(surahQuery).slice(0, 8);
  }, [surahQuery]);

  const selectedSurah = useMemo(() => {
    if (!surahNumber) return null;
    return getSurahById(surahNumber) ?? null;
  }, [surahNumber]);

  const handleSelectSurah = useCallback((surah: Surah) => {
    setSurahNumber(surah.id);
    setSurahQuery('');
    setShowSurahResults(false);
    setStartVerse(null);
    setEndVerse(null);
  }, []);

  const handleClearSurah = useCallback(() => {
    setSurahNumber(null);
    setStartVerse(null);
    setEndVerse(null);
  }, []);

  const handleStartVerseChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (text === '') {
        setStartVerse(null);
        return;
      }
      if (!isNaN(num) && num >= 1) {
        const max = selectedSurah?.verses_count ?? 999;
        setStartVerse(Math.min(num, max));
      }
    },
    [selectedSurah],
  );

  const handleEndVerseChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (text === '') {
        setEndVerse(null);
        return;
      }
      if (!isNaN(num) && num >= 1) {
        const max = selectedSurah?.verses_count ?? 999;
        setEndVerse(Math.min(num, max));
      }
    },
    [selectedSurah],
  );

  // Reciter search (shared by both types)
  const [reciterQuery, setReciterQuery] = useState('');
  const [showReciterResults, setShowReciterResults] = useState(false);

  const reciterResults = useMemo(() => {
    if (!reciterQuery.trim()) return {system: [], custom: []};
    const q = reciterQuery.toLowerCase();
    const system = RECITERS.filter(r => r.name.toLowerCase().includes(q)).slice(
      0,
      5,
    );
    const custom = customReciters
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, 3);
    return {system, custom};
  }, [reciterQuery, customReciters]);

  const hasReciterResults =
    reciterResults.system.length > 0 || reciterResults.custom.length > 0;

  const showCreateOption = reciterQuery.trim().length > 0;

  const handleSelectSystemReciter = useCallback((id: string, name: string) => {
    setReciterId(id);
    setCustomReciterId(null);
    setReciterDisplayName(name);
    setReciterQuery('');
    setShowReciterResults(false);
  }, []);

  const handleSelectCustomReciter = useCallback((id: string, name: string) => {
    setCustomReciterId(id);
    setReciterId(null);
    setReciterDisplayName(name);
    setReciterQuery('');
    setShowReciterResults(false);
    setRewayah(DEFAULT_REWAYAH);
    setStyle(DEFAULT_STYLE);
    setShowMoreOptions(false);
  }, []);

  const handleCreateReciter = useCallback(async () => {
    const name = reciterQuery.trim();
    if (!name) return;
    const newReciter = await createCustomReciter(name);
    handleSelectCustomReciter(newReciter.id, newReciter.name);
  }, [reciterQuery, createCustomReciter, handleSelectCustomReciter]);

  const handleClearReciter = useCallback(() => {
    setReciterId(null);
    setCustomReciterId(null);
    setReciterDisplayName('');
    setRewayah(DEFAULT_REWAYAH);
    setStyle(DEFAULT_STYLE);
    setShowMoreOptions(false);
  }, []);

  const handleCategorySelect = useCallback(
    (cat: UploadedRecitation['category']) => {
      setCategory(prev => (prev === cat ? null : cat));
    },
    [],
  );

  if (!recitation) return null;

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}
      keyboardHandlerEnabled={true}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Pressable onPress={handleClose} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Organize</Text>
        <Pressable
          onPress={handleSave}
          style={[styles.headerButton, {opacity: hasChanges ? 1 : 0.4}]}
          disabled={!hasChanges}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}>
        {/* File Info */}
        <View style={styles.fileInfoRow}>
          <View style={styles.fileIconContainer}>
            <Icon
              name="music"
              type="feather"
              size={moderateScale(16)}
              color={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.fileInfoText}>
            <Text
              style={styles.fileName}
              numberOfLines={1}
              ellipsizeMode="middle">
              {recitation.originalFilename}
            </Text>
            <Text style={styles.fileDuration}>
              {formatDuration(recitation.duration)}
            </Text>
          </View>
        </View>

        {/* Type Chips */}
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, type === 'surah' && styles.chipSelected]}
            onPress={() => handleTypeSelect('surah')}>
            <Text
              style={[
                styles.chipText,
                type === 'surah' && styles.chipTextSelected,
              ]}>
              Surah
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, type === 'other' && styles.chipSelected]}
            onPress={() => handleTypeSelect('other')}>
            <Text
              style={[
                styles.chipText,
                type === 'other' && styles.chipTextSelected,
              ]}>
              Other
            </Text>
          </Pressable>
        </View>

        {/* Surah Picker Section */}
        {type === 'surah' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Surah</Text>
            {selectedSurah ? (
              <View style={styles.selectedItemRow}>
                <View style={styles.selectedItemChip}>
                  <Text style={styles.selectedItemText}>
                    {selectedSurah.id}. {selectedSurah.name}
                  </Text>
                  <Text style={styles.selectedItemArabic}>
                    {selectedSurah.name_arabic}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClearSurah}
                  style={styles.clearButton}>
                  <Icon
                    name="x"
                    type="feather"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchInputContainer}>
                  <Icon
                    name="search"
                    type="feather"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search surahs..."
                    placeholderTextColor={Color(theme.colors.textSecondary)
                      .alpha(0.5)
                      .toString()}
                    value={surahQuery}
                    onChangeText={text => {
                      setSurahQuery(text);
                      setShowSurahResults(true);
                    }}
                    onFocus={() => setShowSurahResults(true)}
                    keyboardAppearance="dark"
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {showSurahResults && surahResults.length > 0 && (
                  <View style={styles.resultsList}>
                    {surahResults.map(surah => (
                      <Pressable
                        key={surah.id}
                        style={styles.resultItem}
                        onPress={() => handleSelectSurah(surah)}>
                        <Text style={styles.resultNumber}>{surah.id}</Text>
                        <View style={styles.resultTextContainer}>
                          <Text style={styles.resultName}>{surah.name}</Text>
                          <Text style={styles.resultTranslation}>
                            {surah.translated_name_english}
                          </Text>
                        </View>
                        <Text style={styles.resultArabic}>
                          {surah.name_arabic}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Verse range inputs */}
            {selectedSurah && (
              <View style={styles.verseRangeContainer}>
                <Text style={styles.verseRangeLabel}>
                  Verse range (optional)
                </Text>
                <View style={styles.verseRangeRow}>
                  <View style={styles.verseInputWrapper}>
                    <TextInput
                      style={styles.verseInput}
                      placeholder="From"
                      placeholderTextColor={Color(theme.colors.textSecondary)
                        .alpha(0.5)
                        .toString()}
                      value={startVerse?.toString() ?? ''}
                      onChangeText={handleStartVerseChange}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      maxLength={3}
                    />
                  </View>
                  <Text style={styles.verseDash}>-</Text>
                  <View style={styles.verseInputWrapper}>
                    <TextInput
                      style={styles.verseInput}
                      placeholder="To"
                      placeholderTextColor={Color(theme.colors.textSecondary)
                        .alpha(0.5)
                        .toString()}
                      value={endVerse?.toString() ?? ''}
                      onChangeText={handleEndVerseChange}
                      keyboardType="number-pad"
                      keyboardAppearance="dark"
                      maxLength={3}
                    />
                  </View>
                  <Text style={styles.verseCountHint}>
                    of {selectedSurah.verses_count} verses
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Other Type Section */}
        {type === 'other' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Title</Text>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={[styles.searchInput, {paddingLeft: 0}]}
                placeholder="e.g., Morning Adhkar"
                placeholderTextColor={Color(theme.colors.textSecondary)
                  .alpha(0.5)
                  .toString()}
                value={title}
                onChangeText={setTitle}
                keyboardAppearance="dark"
                autoCapitalize="sentences"
                maxLength={100}
              />
            </View>

            <Text style={[styles.sectionLabel, {marginTop: moderateScale(16)}]}>
              Category
            </Text>
            <View style={styles.chipRow}>
              {CATEGORY_OPTIONS.map(opt => (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.chip,
                    category === opt.id && styles.chipSelected,
                  ]}
                  onPress={() => handleCategorySelect(opt.id)}>
                  <Text
                    style={[
                      styles.chipText,
                      category === opt.id && styles.chipTextSelected,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Reciter Search (shared by both types) */}
        {type !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Reciter</Text>
            {reciterDisplayName ? (
              <View style={styles.selectedItemRow}>
                <View style={styles.selectedItemChip}>
                  <Text style={styles.selectedItemText}>
                    {reciterDisplayName}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClearReciter}
                  style={styles.clearButton}>
                  <Icon
                    name="x"
                    type="feather"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchInputContainer}>
                  <Icon
                    name="search"
                    type="feather"
                    size={moderateScale(14)}
                    color={theme.colors.textSecondary}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search reciters..."
                    placeholderTextColor={Color(theme.colors.textSecondary)
                      .alpha(0.5)
                      .toString()}
                    value={reciterQuery}
                    onChangeText={text => {
                      setReciterQuery(text);
                      setShowReciterResults(true);
                    }}
                    onFocus={() => setShowReciterResults(true)}
                    keyboardAppearance="dark"
                    returnKeyType="search"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                {showReciterResults &&
                  (hasReciterResults || showCreateOption) && (
                    <View style={styles.resultsList}>
                      {showCreateOption && (
                        <Pressable
                          style={styles.resultItem}
                          onPress={handleCreateReciter}>
                          <Icon
                            name="plus-circle"
                            type="feather"
                            size={moderateScale(16)}
                            color={theme.colors.text}
                          />
                          <View
                            style={[
                              styles.resultTextContainer,
                              {marginLeft: moderateScale(10)},
                            ]}>
                            <Text style={styles.resultName}>
                              Create "{reciterQuery.trim()}"
                            </Text>
                          </View>
                        </Pressable>
                      )}
                      {reciterResults.system.map(r => (
                        <Pressable
                          key={r.id}
                          style={styles.resultItem}
                          onPress={() =>
                            handleSelectSystemReciter(r.id, r.name)
                          }>
                          <View style={styles.resultTextContainer}>
                            <Text style={styles.resultName}>{r.name}</Text>
                          </View>
                        </Pressable>
                      ))}
                      {reciterResults.custom.map(r => (
                        <Pressable
                          key={r.id}
                          style={styles.resultItem}
                          onPress={() =>
                            handleSelectCustomReciter(r.id, r.name)
                          }>
                          <View style={styles.resultTextContainer}>
                            <Text style={styles.resultName}>{r.name}</Text>
                            <Text style={styles.resultTranslation}>
                              Custom reciter
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
              </>
            )}

            {/* More Options toggle */}
            {reciterDisplayName !== '' && (
              <Pressable
                style={styles.moreOptionsToggle}
                onPress={() => setShowMoreOptions(prev => !prev)}>
                <Text style={styles.moreOptionsText}>More Options</Text>
                <Icon
                  name={showMoreOptions ? 'chevron-up' : 'chevron-down'}
                  type="feather"
                  size={moderateScale(14)}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            )}

            {/* Rewayah + Style picklists */}
            {showMoreOptions && reciterDisplayName !== '' && (
              <View style={styles.moreOptionsContainer}>
                <Text style={styles.verseRangeLabel}>Rewayah</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.picklistScroll}
                  contentContainerStyle={styles.picklistContent}>
                  {REWAYAH_OPTIONS.map(opt => (
                    <Pressable
                      key={opt}
                      style={[
                        styles.chip,
                        rewayah === opt && styles.chipSelected,
                      ]}
                      onPress={() => setRewayah(opt)}>
                      <Text
                        style={[
                          styles.chipText,
                          rewayah === opt && styles.chipTextSelected,
                        ]}
                        numberOfLines={1}>
                        {opt}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text
                  style={[
                    styles.verseRangeLabel,
                    {marginTop: moderateScale(14)},
                  ]}>
                  Style
                </Text>
                <View style={styles.chipRow}>
                  {STYLE_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.id}
                      style={[
                        styles.chip,
                        style === opt.id && styles.chipSelected,
                      ]}
                      onPress={() => setStyle(opt.id)}>
                      <Text
                        style={[
                          styles.chipText,
                          style === opt.id && styles.chipTextSelected,
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Delete Button */}
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Icon
            name="trash-2"
            type="feather"
            size={moderateScale(16)}
            color="#EF4444"
          />
          <Text style={styles.deleteText}>Delete Recitation</Text>
        </Pressable>
      </ScrollView>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      paddingTop: moderateScale(8),
      paddingBottom: 0,
      height: SCREEN_HEIGHT * 0.9,
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(20),
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.1).toString(),
    },
    headerButton: {
      minWidth: moderateScale(60),
    },
    headerTitle: {
      fontSize: moderateScale(18),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
    },
    cancelText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    saveText: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'right',
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(40),
    },
    fileInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: moderateScale(16),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.08).toString(),
      marginBottom: moderateScale(20),
    },
    fileIconContainer: {
      width: moderateScale(36),
      height: moderateScale(36),
      borderRadius: moderateScale(18),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: moderateScale(12),
    },
    fileInfoText: {
      flex: 1,
    },
    fileName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    fileDuration: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(2),
    },
    sectionLabel: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: moderateScale(10),
    },
    chipRow: {
      flexDirection: 'row',
      gap: moderateScale(8),
      marginBottom: moderateScale(24),
    },
    chip: {
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(8),
      borderRadius: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
      borderColor: Color(theme.colors.text).alpha(0.2).toString(),
    },
    chipText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    chipTextSelected: {
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
    },
    section: {
      marginBottom: moderateScale(20),
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(12),
      gap: moderateScale(8),
    },
    searchInput: {
      flex: 1,
      paddingVertical: moderateScale(12),
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
    },
    resultsList: {
      marginTop: moderateScale(6),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      overflow: 'hidden',
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(10),
      borderBottomWidth: 1,
      borderBottomColor: Color(theme.colors.border).alpha(0.06).toString(),
    },
    resultNumber: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      width: moderateScale(28),
    },
    resultTextContainer: {
      flex: 1,
    },
    resultName: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    resultTranslation: {
      fontSize: moderateScale(11),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginTop: moderateScale(1),
    },
    resultArabic: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginLeft: moderateScale(8),
    },
    selectedItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedItemChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      borderRadius: moderateScale(10),
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(10),
      gap: moderateScale(8),
    },
    selectedItemText: {
      flex: 1,
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    selectedItemArabic: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
    },
    clearButton: {
      padding: moderateScale(8),
      marginLeft: moderateScale(4),
    },
    verseRangeContainer: {
      marginTop: moderateScale(14),
    },
    verseRangeLabel: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
      marginBottom: moderateScale(8),
    },
    verseRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(8),
    },
    verseInputWrapper: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: moderateScale(10),
      width: moderateScale(64),
    },
    verseInput: {
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.text,
      textAlign: 'center',
    },
    verseDash: {
      fontSize: moderateScale(16),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    verseCountHint: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginLeft: moderateScale(4),
    },
    moreOptionsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: moderateScale(14),
      paddingVertical: moderateScale(8),
      gap: moderateScale(6),
    },
    moreOptionsText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    moreOptionsContainer: {
      marginTop: moderateScale(10),
    },
    picklistScroll: {
      flexGrow: 0,
    },
    picklistContent: {
      gap: moderateScale(8),
      paddingRight: moderateScale(4),
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: moderateScale(14),
      marginTop: moderateScale(16),
      borderRadius: moderateScale(12),
      backgroundColor: Color('#EF4444').alpha(0.08).toString(),
      gap: moderateScale(8),
    },
    deleteText: {
      fontSize: moderateScale(14),
      fontFamily: 'Manrope-SemiBold',
      color: '#EF4444',
    },
  });
