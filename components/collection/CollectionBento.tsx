// @ai-generated
import React, {useMemo} from 'react';
import {Pressable, Text, View, type ViewStyle} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {ReciterImage} from '@/components/ReciterImage';
import SkiaVersePreview from '@/components/share/SkiaVersePreview';
import {surahGlyphMap} from '@/utils/surahGlyphMap';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import type {Reciter} from '@/data/reciterData';
import type {VerseBookmark, VerseNote} from '@/types/verse-annotations';

/** Category colors, kept from the list design so each area stays recognisable. */
export const BENTO_COLORS = {
  loved: '#FF6B6B',
  bookmarks: '#F59E0B',
  downloads: '#10AC84',
  playlists: '#6366F1',
  reciters: '#3B82F6',
  notes: '#8B5CF6',
  uploads: '#EC4899',
} as const;

/** Muted squares behind the surah-name glyphs in the Loved tile. */
const COVER_COLORS = ['#2F5D50', '#7A5A3E', '#3D4E6B', '#5C4470', '#8A4F4F'];

export interface CollectionBentoProps {
  lovedTracks: Array<{reciterId: string; surahId: string; timestamp: number}>;
  latestBookmark: VerseBookmark | null;
  bookmarkCount: number;
  latestNote: VerseNote | null;
  noteCount: number;
  downloads: Array<{reciterId: string; fileSize: number; status: string}>;
  playlistNames: string[];
  favoriteReciters: Reciter[];
  uploadsCount: number;
  onAdd: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

function Label({
  color,
  icon,
  text,
  count,
}: {
  color: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
  count?: number;
}): React.ReactElement {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ink = theme.isDarkMode
    ? Color(color).lighten(0.25).hex()
    : Color(color).darken(0.3).hex();

  return (
    <View style={styles.labelRow}>
      <Feather name={icon} size={moderateScale(13)} color={ink} />
      <Text style={[styles.label, {color: ink}]} numberOfLines={1}>
        {text}
      </Text>
      {count !== undefined && count > 0 ? (
        <Text style={styles.cornerCount}>{localizeDigits(String(count))}</Text>
      ) : null}
    </View>
  );
}

function Tile({
  color,
  onPress,
  style,
  children,
  a11y,
}: {
  color: string;
  onPress: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
  a11y: string;
}): React.ReactElement {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tint = Color(color)
    .alpha(theme.isDarkMode ? 0.16 : 0.12)
    .string();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({pressed}) => [
        styles.tile,
        {backgroundColor: tint, opacity: pressed ? 0.7 : 1},
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/**
 * The Collection tab on phones as a bento grid: each category is a tile
 * sized to what it holds, and each tile previews its contents (the newest
 * loved surahs, the newest bookmarked verse, storage per reciter, reciter
 * photos, the newest note) instead of showing only an icon and a count.
 */
export function CollectionBento({
  lovedTracks,
  latestBookmark,
  bookmarkCount,
  latestNote,
  noteCount,
  downloads,
  playlistNames,
  favoriteReciters,
  uploadsCount,
  onAdd,
}: CollectionBentoProps) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const {t} = useTranslation(['collection', 'common']);

  const go = (route: string) => () => router.push(route as never);

  // Loved: newest first.
  const lovedSorted = useMemo(
    () => [...lovedTracks].sort((a, b) => b.timestamp - a.timestamp),
    [lovedTracks],
  );
  const lastLoved = lovedSorted[0];
  const lastLovedLine = useMemo(() => {
    if (!lastLoved) return null;
    const surah = getSurahById(Number(lastLoved.surahId));
    const reciter = getReciterByIdSync(lastLoved.reciterId);
    const surahName = surah ? getSurahDisplayName(surah) : lastLoved.surahId;
    return t('collectionScreen.bento.lastLoved', {
      surah: surahName,
      reciter: reciter?.name ?? '',
    });
  }, [lastLoved, t]);
  const lovedCovers = lovedSorted.slice(0, 3);

  // Downloads: total size and the share of the top reciters.
  const completed = downloads.filter(d => d.status === 'completed');
  const totalBytes = completed.reduce((s, d) => s + (d.fileSize || 0), 0);
  const byReciter = useMemo(() => {
    const m = new Map<string, number>();
    completed.forEach(d =>
      m.set(d.reciterId, (m.get(d.reciterId) ?? 0) + (d.fileSize || 0)),
    );
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [completed]);

  const bookmarkSurah = latestBookmark
    ? getSurahById(latestBookmark.surahNumber)
    : undefined;
  const noteSurah = latestNote
    ? getSurahById(latestNote.surahNumber)
    : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('common:tabs.collection')}
        </Text>
        <Pressable
          onPress={onAdd}
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel={t('collectionScreen.addToCollection')}>
          <Feather
            name="plus"
            size={moderateScale(18)}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {/* Loved, full width */}
        <Tile
          color={BENTO_COLORS.loved}
          onPress={go('/collection/loved')}
          style={styles.wide}
          a11y={t('collectionScreen.loved')}>
          <View style={styles.lovedRow}>
            <View style={styles.flex}>
              <Label
                color={BENTO_COLORS.loved}
                icon="heart"
                text={t('collectionScreen.loved')}
              />
              {lovedTracks.length > 0 ? (
                <>
                  <Text style={styles.big}>
                    {localizeDigits(String(lovedTracks.length))}
                  </Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {lastLovedLine}
                  </Text>
                </>
              ) : (
                <Text style={styles.empty}>
                  {t('collectionScreen.empty.loved')}
                </Text>
              )}
            </View>
            {lovedCovers.length > 0 ? (
              <View style={styles.coverStack}>
                {lovedCovers.map((track, i) => (
                  <View
                    key={`${track.reciterId}-${track.surahId}`}
                    style={[
                      styles.cover,
                      {
                        backgroundColor:
                          COVER_COLORS[
                            (Number(track.surahId) + i) % COVER_COLORS.length
                          ],
                        marginStart: i === 0 ? 0 : -moderateScale(12),
                        borderColor: theme.colors.background,
                      },
                    ]}>
                    <Text style={styles.coverGlyph}>
                      {surahGlyphMap[Number(track.surahId)] ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Tile>

        {/* Bookmarks, full width, with the newest verse */}
        <Tile
          color={BENTO_COLORS.bookmarks}
          onPress={go('/collection/bookmarks')}
          style={styles.wide}
          a11y={t('common:terms.bookmarks')}>
          <Label
            color={BENTO_COLORS.bookmarks}
            icon="bookmark"
            text={t('common:terms.bookmarks')}
            count={bookmarkCount}
          />
          {latestBookmark ? (
            <>
              <View style={styles.verse} collapsable={false}>
                <SkiaVersePreview
                  verseKey={latestBookmark.verseKey}
                  numberOfLines={1}
                  rewayah={latestBookmark.rewayahId}
                />
              </View>
              <Text style={[styles.small, styles.center]}>
                {bookmarkSurah ? getSurahDisplayName(bookmarkSurah) : ''}{' '}
                {localizeDigits(
                  `${latestBookmark.surahNumber}:${latestBookmark.ayahNumber}`,
                )}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.bookmarks')}
            </Text>
          )}
        </Tile>

        {/* Downloads */}
        <Tile
          color={BENTO_COLORS.downloads}
          onPress={go('/collection/downloads')}
          style={styles.half}
          a11y={t('common:terms.downloads')}>
          <Label
            color={BENTO_COLORS.downloads}
            icon="download"
            text={t('common:terms.downloads')}
          />
          {completed.length > 0 ? (
            <>
              <Text style={styles.big}>
                {localizeDigits(formatSize(totalBytes))}
              </Text>
              <View style={styles.bar}>
                {byReciter.map(([id, bytes], i) => (
                  <View
                    key={id}
                    style={{
                      flex: Math.max(bytes, 1),
                      backgroundColor: Color(BENTO_COLORS.downloads)
                        .alpha(1 - i * 0.3)
                        .string(),
                    }}
                  />
                ))}
                {totalBytes > 0 && byReciter.length > 0 ? (
                  <View
                    style={{
                      flex: Math.max(
                        totalBytes - byReciter.reduce((s, [, b]) => s + b, 0),
                        0,
                      ),
                    }}
                  />
                ) : null}
              </View>
              <Text style={styles.small} numberOfLines={1}>
                {t('common:counts.surahs', {count: completed.length})}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.downloads')}
            </Text>
          )}
        </Tile>

        {/* Playlists */}
        <Tile
          color={BENTO_COLORS.playlists}
          onPress={go('/collection/playlists')}
          style={styles.half}
          a11y={t('common:terms.playlists')}>
          <Label
            color={BENTO_COLORS.playlists}
            icon="list"
            text={t('common:terms.playlists')}
          />
          {playlistNames.length > 0 ? (
            <>
              <Text style={styles.big}>
                {localizeDigits(String(playlistNames.length))}
              </Text>
              <Text style={styles.small} numberOfLines={2}>
                {playlistNames.slice(0, 3).join(', ')}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.playlists')}
            </Text>
          )}
        </Tile>

        {/* Reciters, with their photos */}
        <Tile
          color={BENTO_COLORS.reciters}
          onPress={go('/collection/favorite-reciters')}
          style={styles.half}
          a11y={t('common:terms.reciters')}>
          <Label
            color={BENTO_COLORS.reciters}
            icon="user"
            text={t('common:terms.reciters')}
          />
          {favoriteReciters.length > 0 ? (
            <>
              <View style={styles.faces}>
                {favoriteReciters.slice(0, 3).map((r, i) => (
                  <View
                    key={r.id}
                    style={[
                      styles.face,
                      {
                        marginStart: i === 0 ? 0 : -moderateScale(9),
                        borderColor: theme.colors.background,
                      },
                    ]}>
                    <ReciterImage
                      imageUrl={r.image_url ?? undefined}
                      reciterName={r.name}
                      style={styles.faceImage}
                      profileIconSize={moderateScale(14)}
                    />
                  </View>
                ))}
                {favoriteReciters.length > 3 ? (
                  <View
                    style={[
                      styles.face,
                      styles.moreFace,
                      {
                        marginStart: -moderateScale(9),
                        borderColor: theme.colors.background,
                      },
                    ]}>
                    <Text style={styles.moreText}>
                      +{localizeDigits(String(favoriteReciters.length - 3))}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.small} numberOfLines={1}>
                {t('common:counts.reciters', {count: favoriteReciters.length})}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.reciters')}
            </Text>
          )}
        </Tile>

        {/* Notes, with the newest one */}
        <Tile
          color={BENTO_COLORS.notes}
          onPress={go('/collection/notes')}
          style={styles.half}
          a11y={t('collectionScreen.notes')}>
          <Label
            color={BENTO_COLORS.notes}
            icon="file-text"
            text={t('collectionScreen.notes')}
            count={noteCount}
          />
          {latestNote ? (
            <>
              <Text style={styles.noteText} numberOfLines={3}>
                {latestNote.content}
              </Text>
              <Text style={styles.small} numberOfLines={1}>
                {noteSurah ? getSurahDisplayName(noteSurah) : ''}{' '}
                {localizeDigits(
                  `${latestNote.surahNumber}:${latestNote.ayahNumber}`,
                )}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.notes')}
            </Text>
          )}
        </Tile>

        {/* Uploads */}
        <Tile
          color={BENTO_COLORS.uploads}
          onPress={go('/collection/uploads')}
          style={styles.half}
          a11y={t('common:terms.uploads')}>
          <Label
            color={BENTO_COLORS.uploads}
            icon="mic"
            text={t('common:terms.uploads')}
          />
          {uploadsCount > 0 ? (
            <>
              <Text style={styles.big}>
                {localizeDigits(String(uploadsCount))}
              </Text>
              <Text style={styles.small} numberOfLines={1}>
                {t('uploadsScreen.recitationsCount', {count: uploadsCount})}
              </Text>
            </>
          ) : (
            <Text style={styles.empty}>
              {t('collectionScreen.empty.uploads')}
            </Text>
          )}
        </Tile>

        {/* Add */}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={({pressed}) => [
            styles.tile,
            styles.half,
            styles.addTile,
            {opacity: pressed ? 0.6 : 1},
          ]}>
          <Feather
            name="plus"
            size={moderateScale(20)}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.addText}>
            {t('collectionScreen.addToCollection')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    root: {
      paddingHorizontal: '16@ms',
      gap: '14@ms',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: theme.fonts.extraBold,
      fontSize: '30@ms',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    addButton: {
      width: '38@ms',
      height: '38@ms',
      borderRadius: '19@ms',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.07).string(),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: '10@ms',
    },
    tile: {
      borderRadius: '20@ms',
      padding: '13@ms',
      gap: '6@ms',
      minHeight: '112@ms',
    },
    wide: {width: '100%'},
    half: {width: '48.5%'},
    flex: {flex: 1, gap: '4@ms'},
    labelRow: {flexDirection: 'row', alignItems: 'center', gap: '5@ms'},
    label: {fontFamily: theme.fonts.bold, fontSize: '13@ms', flexShrink: 1},
    cornerCount: {
      marginStart: 'auto',
      fontFamily: theme.fonts.semiBold,
      fontSize: '12@ms',
      color: theme.colors.textSecondary,
    },
    big: {
      fontFamily: theme.fonts.extraBold,
      fontSize: '26@ms',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    small: {
      fontFamily: theme.fonts.medium,
      fontSize: '11.5@ms',
      color: theme.colors.textSecondary,
    },
    center: {textAlign: 'center'},
    empty: {
      fontFamily: theme.fonts.medium,
      fontSize: '12.5@ms',
      color: theme.colors.textSecondary,
      marginTop: 'auto',
    },
    lovedRow: {flexDirection: 'row', alignItems: 'center', gap: '12@ms'},
    coverStack: {flexDirection: 'row'},
    cover: {
      width: '46@ms',
      height: '46@ms',
      borderRadius: '11@ms',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    coverGlyph: {fontFamily: 'SurahNames', fontSize: '26@ms', color: '#FFFFFF'},
    verse: {minHeight: '40@ms', justifyContent: 'center'},
    bar: {
      flexDirection: 'row',
      height: '6@ms',
      borderRadius: '3@ms',
      overflow: 'hidden',
      backgroundColor: Color(theme.colors.text).alpha(0.1).string(),
    },
    faces: {flexDirection: 'row', marginTop: '2@ms'},
    face: {
      width: '34@ms',
      height: '34@ms',
      borderRadius: '17@ms',
      borderWidth: 2,
      overflow: 'hidden',
    },
    faceImage: {width: '100%', height: '100%'},
    moreFace: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.15).string(),
    },
    moreText: {
      fontFamily: theme.fonts.bold,
      fontSize: '11@ms',
      color: theme.colors.text,
    },
    noteText: {
      fontFamily: theme.fonts.medium,
      fontSize: '12.5@ms',
      lineHeight: '17@ms',
      color: theme.colors.text,
    },
    addTile: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: Color(theme.colors.text).alpha(0.2).string(),
    },
    addText: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '12.5@ms',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
