import React, {useCallback, useMemo, useRef, useEffect, useState} from 'react';
import {StyleSheet, StatusBar, View, Platform, BackHandler} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {useUnifiedPlayer} from '@/hooks/useUnifiedPlayer';
import {useTheme} from '@/hooks/useTheme';
import PlayerContent from './PlayerContent';
import Color from 'color';
import {PlaybackSpeedModal} from './Modals/PlaybackSpeedModal';
import {SleepTimerModal} from './Modals/SleepTimerModal';
import {ExtendedSummaryModal} from './SurahSummary/ExtendedSummaryModal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MushafLayoutModal} from './Modals/MushafLayoutModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import surah info data
const surahInfo = require('@/data/surahInfo.json');

// AsyncStorage Keys
const SHOW_TRANSLATION_KEY = '@MushafLayout:showTranslation';
const SHOW_TRANSLITERATION_KEY = '@MushafLayout:showTransliteration';
const ARABIC_FONT_SIZE_KEY = '@MushafLayout:arabicFontSize';
const TRANSLATION_FONT_SIZE_KEY = '@MushafLayout:translationFontSize';
const TRANSLITERATION_FONT_SIZE_KEY = '@MushafLayout:transliterationFontSize';

// Default font sizes - adjusted to align with steps (Min 10, Max 46, Step 4)
const DEFAULT_TRANSLITERATION_FONT_SIZE = 14; // Display Level 2
const DEFAULT_TRANSLATION_FONT_SIZE = 18; // Display Level 3
const DEFAULT_ARABIC_FONT_SIZE = 26; // Display Level 5

// Custom handle component for the bottom sheet
const CustomHandle = (_props: BottomSheetHandleProps) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.handleContainer, {paddingTop: insets.top + 12}]}>
      <View
        style={[
          styles.handle,
          {backgroundColor: Color(theme.colors.text).alpha(0.2).toString()},
        ]}
      />
    </View>
  );
};

export const PlayerSheet = () => {
  const {theme} = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const speedBottomSheetRef = useRef<BottomSheet>(null);
  const sleepBottomSheetRef = useRef<BottomSheet>(null);
  const queueBottomSheetRef = useRef<BottomSheet>(null);
  const summaryBottomSheetRef = useRef<BottomSheet>(null);
  const mushafLayoutSheetRef = useRef<BottomSheet>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [transliterationFontSize, setTransliterationFontSize] = useState(
    DEFAULT_TRANSLITERATION_FONT_SIZE,
  );
  const [translationFontSize, setTranslationFontSize] = useState(
    DEFAULT_TRANSLATION_FONT_SIZE,
  );
  const [arabicFontSize, setArabicFontSize] = useState(
    DEFAULT_ARABIC_FONT_SIZE,
  );

  // Add state to track if settings have loaded
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const {
    queue,
    loading,
    sheetMode,
    setSheetMode,
    playback,
    setRate,
    settings,
    updateSettings,
  } = useUnifiedPlayer();

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          translationValue,
          transliterationValue,
          arabicFontSizeValue,
          translationFontSizeValue,
          transliterationFontSizeValue,
        ] = await Promise.all([
          AsyncStorage.getItem(SHOW_TRANSLATION_KEY),
          AsyncStorage.getItem(SHOW_TRANSLITERATION_KEY),
          AsyncStorage.getItem(ARABIC_FONT_SIZE_KEY),
          AsyncStorage.getItem(TRANSLATION_FONT_SIZE_KEY),
          AsyncStorage.getItem(TRANSLITERATION_FONT_SIZE_KEY),
        ]);

        // Helper to parse font size, falling back to default
        const parseFontSize = (value: string | null, defaultValue: number) => {
          if (value !== null) {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              return parsed;
            }
          }
          return defaultValue;
        };

        // Use loaded value or default
        const loadedShowTranslation =
          translationValue !== null ? JSON.parse(translationValue) : true;
        const loadedShowTransliteration =
          transliterationValue !== null
            ? JSON.parse(transliterationValue)
            : true;
        const loadedArabicSize = parseFontSize(
          arabicFontSizeValue,
          DEFAULT_ARABIC_FONT_SIZE,
        );
        const loadedTranslationSize = parseFontSize(
          translationFontSizeValue,
          DEFAULT_TRANSLATION_FONT_SIZE,
        );
        const loadedTranslitSize = parseFontSize(
          transliterationFontSizeValue,
          DEFAULT_TRANSLITERATION_FONT_SIZE,
        );

        // Update state
        setShowTranslation(loadedShowTranslation);
        setShowTransliteration(loadedShowTransliteration);
        setArabicFontSize(loadedArabicSize);
        setTranslationFontSize(loadedTranslationSize);
        setTransliterationFontSize(loadedTranslitSize);

        console.log('Mushaf settings loaded:', {
          showTranslation: loadedShowTranslation,
          showTransliteration: loadedShowTransliteration,
          arabicFontSize: loadedArabicSize,
          translationFontSize: loadedTranslationSize,
          transliterationFontSize: loadedTranslitSize,
        });
      } catch (e) {
        console.error('Failed to load mushaf layout settings', e);
        // Keep defaults if loading fails
        setShowTranslation(true);
        setShowTransliteration(true);
        setArabicFontSize(DEFAULT_ARABIC_FONT_SIZE);
        setTranslationFontSize(DEFAULT_TRANSLATION_FONT_SIZE);
        setTransliterationFontSize(DEFAULT_TRANSLITERATION_FONT_SIZE);
      } finally {
        setSettingsLoaded(true); // Mark settings as loaded
      }
    };

    loadSettings();
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      if (sheetMode === 'full') {
        setSheetMode('hidden');
        return true; // Prevent default behavior
      }
      return false; // Let default behavior happen
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => subscription.remove();
  }, [sheetMode, setSheetMode]);

  // Effect to handle sleep timer remaining time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (settings.sleepTimerEnd) {
      interval = setInterval(() => {
        // Calculate remaining time based on the end timestamp
        const now = Date.now();
        const timeRemaining = settings.sleepTimerEnd
          ? settings.sleepTimerEnd - now
          : 0;

        if (timeRemaining > 0) {
          // For very short timers (less than 1 minute), display seconds
          if (timeRemaining < 60 * 1000) {
            const remainingSeconds = Math.ceil(timeRemaining / 1000);
            setRemainingTime(remainingSeconds / 60); // Convert to fractional minutes
          } else {
            const remainingMinutes = Math.ceil(timeRemaining / (60 * 1000));
            setRemainingTime(remainingMinutes);
          }
        } else {
          setRemainingTime(null);
        }
      }, 500); // Update more frequently for short timers
    } else {
      setRemainingTime(null);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [settings.sleepTimerEnd]);

  // Effect to handle sheet mode changes
  useEffect(() => {
    if (!bottomSheetRef.current) return;

    const sheet = bottomSheetRef.current;
    if (sheetMode === 'hidden') {
      sheet.close();
    } else if (sheetMode === 'full') {
      sheet.expand();
    }
  }, [sheetMode]);

  const currentTrack = queue?.tracks?.[queue?.currentIndex ?? -1];
  const shouldShow = !loading?.stateRestoring && !!currentTrack;

  const snapPoints = useMemo(() => ['100%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      const newMode = index === 0 ? 'full' : 'hidden';
      if (sheetMode !== newMode) {
        setSheetMode(newMode);
      }
    },
    [setSheetMode, sheetMode],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      setRate(speed);
      speedBottomSheetRef.current?.close();
    },
    [setRate],
  );

  const handleSleepTimerChange = useCallback(
    (minutes: number) => {
      updateSettings({sleepTimer: minutes});
      sleepBottomSheetRef.current?.close();
    },
    [updateSettings],
  );

  const handleTurnOffTimer = useCallback(() => {
    updateSettings({sleepTimer: 0});
    sleepBottomSheetRef.current?.close();
  }, [updateSettings]);

  // Callbacks for Mushaf Layout Options
  const toggleTranslation = useCallback(async () => {
    const newValue = !showTranslation;
    setShowTranslation(newValue);
    try {
      await AsyncStorage.setItem(
        SHOW_TRANSLATION_KEY,
        JSON.stringify(newValue),
      );
      console.log('Saved showTranslation:', newValue);
    } catch (e) {
      console.error('Failed to save showTranslation setting', e);
    }
  }, [showTranslation]);

  const toggleTransliteration = useCallback(async () => {
    const newValue = !showTransliteration;
    setShowTransliteration(newValue);
    try {
      await AsyncStorage.setItem(
        SHOW_TRANSLITERATION_KEY,
        JSON.stringify(newValue),
      );
      console.log('Saved showTransliteration:', newValue);
    } catch (e) {
      console.error('Failed to save showTransliteration setting', e);
    }
  }, [showTransliteration]);

  const handleTransliterationFontSizeChange = useCallback(
    async (size: number) => {
      setTransliterationFontSize(size);
      try {
        await AsyncStorage.setItem(TRANSLITERATION_FONT_SIZE_KEY, String(size));
        console.log('Saved transliterationFontSize:', size);
      } catch (e) {
        console.error('Failed to save transliterationFontSize setting', e);
      }
    },
    [],
  );

  const handleTranslationFontSizeChange = useCallback(async (size: number) => {
    setTranslationFontSize(size);
    try {
      await AsyncStorage.setItem(TRANSLATION_FONT_SIZE_KEY, String(size));
      console.log('Saved translationFontSize:', size);
    } catch (e) {
      console.error('Failed to save translationFontSize setting', e);
    }
  }, []);

  const handleArabicFontSizeChange = useCallback(async (size: number) => {
    setArabicFontSize(size);
    try {
      await AsyncStorage.setItem(ARABIC_FONT_SIZE_KEY, String(size));
      console.log('Saved arabicFontSize:', size);
    } catch (e) {
      console.error('Failed to save arabicFontSize setting', e);
    }
  }, []);

  // Only render modals once settings are loaded to prevent hydration issues
  if (!shouldShow || !settingsLoaded) {
    return null;
  }

  const currentIndex = sheetMode === 'full' ? 0 : -1;
  const textColor = Color(theme.colors.text);
  const isLightText = textColor.isLight();

  // Get current surah info for the summary modal
  const surahNumber = currentTrack?.surahId
    ? parseInt(currentTrack.surahId, 10)
    : undefined;
  const currentSurahInfo = surahNumber ? surahInfo[surahNumber] : undefined;

  return (
    <>
      {sheetMode === 'full' && (
        <StatusBar barStyle={isLightText ? 'light-content' : 'dark-content'} />
      )}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        index={currentIndex}
        animateOnMount={false}
        handleComponent={CustomHandle}
        enableContentPanningGesture={Platform.OS === 'ios'}
        style={styles.sheet}
        backgroundStyle={[
          styles.background,
          {backgroundColor: theme.colors.background},
        ]}>
        <PlayerContent
          speedBottomSheetRef={speedBottomSheetRef}
          sleepBottomSheetRef={sleepBottomSheetRef}
          queueBottomSheetRef={queueBottomSheetRef}
          summaryBottomSheetRef={summaryBottomSheetRef}
          mushafLayoutSheetRef={mushafLayoutSheetRef}
          showTranslation={showTranslation}
          showTransliteration={showTransliteration}
          transliterationFontSize={transliterationFontSize}
          translationFontSize={translationFontSize}
          arabicFontSize={arabicFontSize}
        />
      </BottomSheet>

      <PlaybackSpeedModal
        bottomSheetRef={speedBottomSheetRef}
        onSpeedChange={handleSpeedChange}
        currentSpeed={playback.rate}
      />

      <SleepTimerModal
        bottomSheetRef={sleepBottomSheetRef}
        onTimerChange={handleSleepTimerChange}
        onTurnOffTimer={handleTurnOffTimer}
        sleepTimer={remainingTime || 0}
        remainingTime={remainingTime}
      />

      {currentSurahInfo && (
        <ExtendedSummaryModal
          bottomSheetRef={summaryBottomSheetRef}
          surahInfo={currentSurahInfo}
        />
      )}

      <MushafLayoutModal
        bottomSheetRef={mushafLayoutSheetRef}
        showTranslation={showTranslation}
        toggleTranslation={toggleTranslation}
        showTransliteration={showTransliteration}
        toggleTransliteration={toggleTransliteration}
        transliterationFontSize={transliterationFontSize}
        translationFontSize={translationFontSize}
        onTransliterationFontSizeChange={handleTransliterationFontSizeChange}
        onTranslationFontSizeChange={handleTranslationFontSizeChange}
        arabicFontSize={arabicFontSize}
        onArabicFontSizeChange={handleArabicFontSizeChange}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sheet: {
    zIndex: 2000,
  },
  background: {
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
  },
  handleContainer: {
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
});
