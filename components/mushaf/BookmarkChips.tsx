import React, {useState, useEffect} from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {SURAHS} from '@/data/surahData';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import type {VerseBookmark} from '@/types/verse-annotations';

// Module-level cache — warmed by AppInitializer after DB is ready
let cachedBookmarks: VerseBookmark[] = [];

/** Called from AppInitializer after VerseAnnotations DB is initialized */
export async function warmBookmarkCache(): Promise<void> {
  cachedBookmarks = await verseAnnotationService.getAllBookmarks();
}

interface BookmarkChipsProps {
  onPress: (surahId: number) => void;
}

export const BookmarkChips: React.FC<BookmarkChipsProps> = React.memo(
  ({onPress}) => {
    const {theme} = useTheme();
    const [bookmarks, setBookmarks] = useState(cachedBookmarks);

    // Refresh from DB on mount (covers new bookmarks added since cache)
    useEffect(() => {
      verseAnnotationService.getAllBookmarks().then(b => {
        cachedBookmarks = b;
        setBookmarks(b);
      });
    }, []);

    if (bookmarks.length === 0) return null;

    return (
      <View style={styles.container}>
        <Text style={[styles.label, {color: theme.colors.textSecondary}]}>
          Bookmarks
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {bookmarks.map(bookmark => {
            const surah =
              bookmark.surahNumber >= 1 && bookmark.surahNumber <= 114
                ? SURAHS[bookmark.surahNumber - 1]
                : null;
            if (!surah) return null;

            return (
              <Pressable
                key={bookmark.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: Color(theme.colors.text)
                      .alpha(0.06)
                      .toString(),
                  },
                ]}
                onPress={() => onPress(bookmark.surahNumber)}>
                <Feather
                  name="bookmark"
                  size={moderateScale(12)}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={[styles.chipText, {color: theme.colors.text}]}
                  numberOfLines={1}>
                  {surah.name} {bookmark.surahNumber}:{bookmark.ayahNumber}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

BookmarkChips.displayName = 'BookmarkChips';

const styles = StyleSheet.create({
  container: {
    marginBottom: moderateScale(12),
  },
  label: {
    fontSize: moderateScale(10),
    fontFamily: 'Manrope-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: moderateScale(8),
    paddingHorizontal: moderateScale(16),
  },
  scrollContent: {
    paddingHorizontal: moderateScale(16),
    gap: moderateScale(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
    gap: moderateScale(6),
  },
  chipText: {
    fontSize: moderateScale(12),
    fontFamily: 'Manrope-Medium',
  },
});
