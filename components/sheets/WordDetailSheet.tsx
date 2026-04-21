import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {SheetProps} from 'react-native-actions-sheet';
import Color from 'color';
import {wbwDataService, type WBWWord} from '@/services/wbw/WBWDataService';
import {createAudioPlayer, AudioPlayer} from 'expo-audio';
import {PlayIcon, PauseIcon} from '@/components/Icons';

export const WordDetailSheet = (props: SheetProps<'word-detail'>) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const verseKey = props.payload?.verseKey ?? '';
  const position = props.payload?.position ?? 0;

  const [wbwWord, setWbwWord] = useState<WBWWord | null>(null);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);

  // Load word data
  useEffect(() => {
    if (!verseKey || !position) return;
    let cancelled = false;

    (async () => {
      const words = await wbwDataService.getVerseWords(verseKey);
      if (cancelled) return;

      const word = words.find(w => w.position === position) ?? null;
      setWbwWord(word);
      setTotalWords(words.length);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [verseKey, position]);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch {
          // ignore cleanup errors
        }
        playerRef.current = null;
      }
    };
  }, []);

  // Build correct audio URL from verse key + position.
  // The Quran.com API audio_url uses total-token numbering (includes stop marks),
  // but qurancdn.com files use word-only numbering, causing mismatches on verses
  // with stop marks. Generating from position is always correct.
  const audioUrl = useMemo(() => {
    if (!verseKey || !position) return '';
    const [s, a] = verseKey.split(':');
    return `https://audio.qurancdn.com/wbw/${s.padStart(3, '0')}_${a.padStart(
      3,
      '0',
    )}_${String(position).padStart(3, '0')}.mp3`;
  }, [verseKey, position]);

  const handlePlayPress = useCallback(() => {
    if (!audioUrl) return;

    // If already playing, pause
    if (isPlaying && playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {
        // ignore
      }
      setIsPlaying(false);
      return;
    }

    // Release previous player if any
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }

    setAudioLoading(true);

    try {
      const player = createAudioPlayer({uri: audioUrl});
      playerRef.current = player;

      const subscription = player.addListener(
        'playbackStatusUpdate',
        status => {
          if (status.playing) {
            setAudioLoading(false);
            setIsPlaying(true);
          }
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        },
      );

      player.play();

      // Store cleanup for subscription
      const originalCleanup = playerRef.current;
      if (originalCleanup) {
        const origRemove = originalCleanup.remove.bind(originalCleanup);
        originalCleanup.remove = () => {
          subscription.remove();
          origRemove();
        };
      }
    } catch (error) {
      console.error('[WordDetailSheet] Audio playback failed:', error);
      setAudioLoading(false);
      setIsPlaying(false);
    }
  }, [audioUrl, isPlaying]);

  if (!props.payload) return null;

  const [surahNum, ayahNum] = verseKey.split(':');

  return (
    <ActionSheet
      id={props.sheetId}
      containerStyle={styles.sheetContainer}
      indicatorStyle={styles.indicator}
      gestureEnabled={true}>
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.textSecondary}
            style={styles.loader}
          />
        ) : (
          <>
            {/* Arabic text */}
            {wbwWord?.textUthmani ? (
              <Text style={styles.arabicText}>{wbwWord.textUthmani}</Text>
            ) : null}

            {/* Transliteration */}
            {wbwWord?.transliteration ? (
              <Text style={styles.transliteration}>
                {wbwWord.transliteration}
              </Text>
            ) : null}

            {/* Translation */}
            {wbwWord?.translation ? (
              <Text style={styles.translation}>
                &ldquo;{wbwWord.translation}&rdquo;
              </Text>
            ) : null}

            {/* Play pronunciation pill */}
            {audioUrl ? (
              <Pressable
                style={({pressed}) => [
                  styles.playPill,
                  pressed && styles.playPillPressed,
                ]}
                onPress={handlePlayPress}>
                {audioLoading ? (
                  <ActivityIndicator
                    size={moderateScale(12)}
                    color={theme.colors.text}
                  />
                ) : isPlaying ? (
                  <PauseIcon
                    size={moderateScale(13)}
                    color={theme.colors.text}
                  />
                ) : (
                  <PlayIcon
                    size={moderateScale(13)}
                    color={theme.colors.text}
                  />
                )}
                <Text style={styles.playPillText}>
                  {audioLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
                </Text>
              </Pressable>
            ) : null}

            {/* Context footer */}
            <Text style={styles.contextText}>
              Verse {surahNum}:{ayahNum} {'\u00B7'} Word {position} of{' '}
              {totalWords}
            </Text>
          </>
        )}
      </View>
    </ActionSheet>
  );
};

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: moderateScale(20),
      borderTopRightRadius: moderateScale(20),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
      paddingTop: moderateScale(8),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: moderateScale(40),
      height: 2.5,
    },
    container: {
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(30),
      alignItems: 'center',
    },
    loader: {
      marginTop: verticalScale(40),
      marginBottom: verticalScale(40),
    },
    arabicText: {
      fontSize: moderateScale(36),
      fontFamily: 'Uthmani',
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: moderateScale(12),
      marginBottom: moderateScale(8),
    },
    playPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: moderateScale(6),
      paddingVertical: moderateScale(7),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(20),
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
      marginBottom: moderateScale(14),
    },
    playPillPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.14).toString(),
    },
    playPillText: {
      fontSize: moderateScale(12.5),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    transliteration: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      fontStyle: 'italic',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
      marginBottom: moderateScale(4),
    },
    translation: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-Medium',
      color: Color(theme.colors.text).alpha(0.85).toString(),
      textAlign: 'center',
      marginBottom: moderateScale(16),
    },
    contextText: {
      fontSize: moderateScale(12),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      textAlign: 'center',
    },
  });
