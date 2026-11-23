// @ai-generated
import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect, useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale, ScaledSheet} from '@/utils/scale';
// @ai-start
import {
  GROUPED_CARD_RADIUS,
  GROUPED_HEADER_GAP,
  SETTINGS_ROW_INSET,
  groupedCardColor,
  groupedHeaderStyle,
  groupedSeparatorColor,
} from '@/components/settings/SettingsList';
// @ai-end
import {Theme} from '@/utils/themeUtils';
import {flipX} from '@/utils/rtl';
import {useLoved} from '@/hooks/useLoved';
import {usePlaylists} from '@/hooks/usePlaylists';
import {usePlaylistCovers} from '@/hooks/useCollectionPreviews';
import {useFavoriteReciters} from '@/hooks/useFavoriteReciters';
import {useDownloads} from '@/services/player/store/downloadSelectors';
import {useUploadsStore} from '@/store/uploadsStore';
import {getReciterByIdSync, getSurahById} from '@/services/dataService';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  localizeDigits,
} from '@/i18n/format';
import {matchesQuery, matchesVerseRef} from '@/utils/collectionSearch';
import {
  CollectionPreview,
  type CollectionCategoryId,
  type CollectionPreviewData,
} from '@/components/collection/CollectionArt';
import {ReciterImage} from '@/components/ReciterImage';
import type {VerseBookmark, VerseNote} from '@/types/verse-annotations';

interface Result {
  key: string;
  title: string;
  subtitle?: string;
  art: React.ReactNode;
  onPress: () => void;
}

interface Group {
  id: CollectionCategoryId;
  label: string;
  results: Result[];
  /** Opens the category's own screen with the same search. */
  seeAll: () => void;
}

const PER_GROUP = 4;

/**
 * Search across everything saved in the Collection tab, grouped by where
 * each result lives. A surah, a reciter, a verse number ("2:255") or words
 * from a note all work. Playlists and reciters open directly; the rest open
 * their own screen with the search already typed in.
 */
export function CollectionSearchResults({query}: {query: string}) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation(['collection', 'common']);
  const router = useRouter();
  const {lovedTracks} = useLoved();
  const {playlists} = usePlaylists();
  const playlistCovers = usePlaylistCovers(playlists);
  const {favoriteReciters} = useFavoriteReciters();
  const downloads = useDownloads();
  const uploads = useUploadsStore(s => s.recitations);
  const [bookmarks, setBookmarks] = useState<VerseBookmark[]>([]);
  const [notes, setNotes] = useState<VerseNote[]>([]);
  const [scope, setScope] = useState<CollectionCategoryId | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      let live = true;
      verseAnnotationService
        .getAllBookmarks()
        .then(b => live && setBookmarks(b))
        .catch(() => undefined);
      verseAnnotationService
        .getAllNotes()
        .then(n => live && setNotes(n))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, []),
  );

  const groups = useMemo<Group[]>(() => {
    const q = query.trim();
    const open = (pathname: string) => () =>
      router.push({pathname: pathname as never, params: {q}});
    const art = (
      category: CollectionCategoryId,
      data: CollectionPreviewData,
    ) => (
      <CollectionPreview
        category={category}
        data={data}
        size={moderateScale(40)}
      />
    );
    const surahFields = (surahNumber: number) => {
      const surah = getSurahById(surahNumber);
      return [
        surah ? getSurahDisplayName(surah) : '',
        surah?.name,
        surah?.translated_name_english,
      ];
    };
    const verseLabel = (surahNumber: number, ayahNumber: number) => {
      const surah = getSurahById(surahNumber);
      const ref = localizeDigits(`${surahNumber}:${ayahNumber}`);
      return surah ? `${getSurahDisplayName(surah)} ${ref}` : ref;
    };

    const loved: Result[] = [...lovedTracks]
      .sort((a, b) => b.timestamp - a.timestamp)
      .flatMap(track => {
        const surah = getSurahById(Number(track.surahId));
        const reciter = getReciterByIdSync(track.reciterId);
        if (!surah) return [];
        const reciterName = reciter ? getReciterDisplayName(reciter) : '';
        if (
          !matchesQuery(q, [
            ...surahFields(surah.id),
            reciterName,
            reciter?.name,
          ])
        ) {
          return [];
        }
        return [
          {
            key: `loved-${track.reciterId}-${track.surahId}-${track.rewayatId}-${track.userRecitationId}`,
            title: getSurahDisplayName(surah),
            subtitle: reciterName,
            art: art('loved', {kind: 'cover', surahId: surah.id}),
            onPress: open('/collection/loved'),
          },
        ];
      });

    const playlistResults: Result[] = playlists
      .filter(p => matchesQuery(q, [p.name, p.description]))
      .map(p => ({
        key: `playlist-${p.id}`,
        title: p.name,
        subtitle: t('common:counts.surahs', {count: p.itemCount}),
        art: art(
          'playlists',
          (playlistCovers[p.id]?.length ?? 0) > 0
            ? {kind: 'mosaic', surahIds: playlistCovers[p.id]}
            : null,
        ),
        onPress: () => router.push(`/playlist/${p.id}` as never),
      }));

    const downloadResults: Result[] = downloads
      .filter(d => d.status === 'completed')
      .flatMap(d => {
        const surah = getSurahById(Number(d.surahId));
        const reciter = getReciterByIdSync(d.reciterId);
        if (!surah) return [];
        const reciterName = reciter ? getReciterDisplayName(reciter) : '';
        if (
          !matchesQuery(q, [
            ...surahFields(surah.id),
            reciterName,
            reciter?.name,
          ])
        ) {
          return [];
        }
        return [
          {
            key: `download-${d.reciterId}-${d.surahId}-${d.rewayatId}`,
            title: getSurahDisplayName(surah),
            subtitle: reciterName,
            art: art('downloads', {
              kind: 'cover',
              surahId: surah.id,
              badge: 'download',
            }),
            onPress: open('/collection/downloads'),
          },
        ];
      });

    const bookmarkResults: Result[] = [...bookmarks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter(
        b =>
          matchesVerseRef(q, b.surahNumber, b.ayahNumber) ||
          matchesQuery(q, surahFields(b.surahNumber)),
      )
      .map(b => ({
        key: `bookmark-${b.id}`,
        title: verseLabel(b.surahNumber, b.ayahNumber),
        art: art('bookmarks', {
          kind: 'verse',
          surahNumber: b.surahNumber,
          ayahNumber: b.ayahNumber,
        }),
        onPress: open('/collection/bookmarks'),
      }));

    const noteResults: Result[] = [...notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter(
        n =>
          matchesVerseRef(q, n.surahNumber, n.ayahNumber) ||
          matchesQuery(q, [n.content, ...surahFields(n.surahNumber)]),
      )
      .map(n => ({
        key: `note-${n.id}`,
        title: t('collectionScreen.summary.quote', {
          text: n.content.split('\n')[0],
        }),
        subtitle: verseLabel(n.surahNumber, n.ayahNumber),
        art: art('notes', {kind: 'note'}),
        onPress: open('/collection/notes'),
      }));

    const reciterResults: Result[] = favoriteReciters
      .filter(r => matchesQuery(q, [getReciterDisplayName(r), r.name]))
      .map(r => ({
        key: `reciter-${r.id}`,
        title: getReciterDisplayName(r),
        art: (
          <ReciterImage
            imageUrl={r.image_url ?? undefined}
            reciterName={r.name}
            style={styles.face}
            profileIconSize={moderateScale(18)}
          />
        ),
        onPress: () => router.push(`/reciter/${r.id}` as never),
      }));

    const uploadResults: Result[] = uploads
      .filter(u =>
        matchesQuery(q, [
          u.title,
          u.originalFilename,
          ...(u.surahNumber ? surahFields(u.surahNumber) : []),
        ]),
      )
      .map(u => {
        const surah = u.surahNumber ? getSurahById(u.surahNumber) : undefined;
        return {
          key: `upload-${u.id}`,
          title:
            u.title ??
            (surah ? getSurahDisplayName(surah) : u.originalFilename),
          art: art(
            'uploads',
            u.surahNumber
              ? {kind: 'cover', surahId: u.surahNumber, badge: 'upload'}
              : null,
          ),
          onPress: open('/collection/uploads'),
        };
      });

    const all: Group[] = [
      {
        id: 'loved',
        label: t('collectionScreen.loved'),
        results: loved,
        seeAll: open('/collection/loved'),
      },
      {
        id: 'playlists',
        label: t('common:terms.playlists'),
        results: playlistResults,
        seeAll: open('/collection/playlists'),
      },
      {
        id: 'downloads',
        label: t('common:terms.downloads'),
        results: downloadResults,
        seeAll: open('/collection/downloads'),
      },
      {
        id: 'bookmarks',
        label: t('common:terms.bookmarks'),
        results: bookmarkResults,
        seeAll: open('/collection/bookmarks'),
      },
      {
        id: 'notes',
        label: t('collectionScreen.notes'),
        results: noteResults,
        seeAll: open('/collection/notes'),
      },
      {
        id: 'reciters',
        label: t('common:terms.reciters'),
        results: reciterResults,
        seeAll: open('/collection/favorite-reciters'),
      },
      {
        id: 'uploads',
        label: t('common:terms.uploads'),
        results: uploadResults,
        seeAll: open('/collection/uploads'),
      },
    ];
    return q ? all : all.map(g => ({...g, results: []}));
  }, [
    query,
    router,
    lovedTracks,
    playlists,
    playlistCovers,
    downloads,
    bookmarks,
    notes,
    favoriteReciters,
    uploads,
    styles.face,
    t,
  ]);

  const q = query.trim();
  const shown = groups.filter(
    g => g.results.length > 0 && (scope === 'all' || g.id === scope),
  );

  return (
    <View style={styles.root}>
      {/* The category pills are there from the first tap, so a search can
          be narrowed before anything is typed. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipsScroller}
        contentContainerStyle={styles.chips}>
        {(['all', ...groups.map(g => g.id)] as const).map(id => {
          const on = id === scope;
          const label =
            id === 'all'
              ? t('collectionScreen.search.all')
              : groups.find(g => g.id === id)?.label;
          return (
            <Pressable
              key={id}
              onPress={() => setScope(id)}
              accessibilityRole="button"
              accessibilityState={{selected: on}}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!q ? (
        <Text style={styles.empty}>{t('collectionScreen.search.hint')}</Text>
      ) : shown.length === 0 ? (
        <Text style={styles.empty}>
          {t('collectionScreen.search.noResults', {query: q})}
        </Text>
      ) : null}
      {shown.map(group => {
        const rows =
          scope === 'all' ? group.results.slice(0, PER_GROUP) : group.results;
        const more = group.results.length - rows.length;
        return (
          <View key={group.id} style={styles.section}>
            <Text style={styles.sectionLabel} accessibilityRole="header">
              {group.label}
            </Text>
            <View style={styles.card}>
              {rows.map((r, i) => (
                <View key={r.key}>
                  {i > 0 ? <View style={styles.separator} /> : null}
                  <Pressable
                    onPress={r.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={
                      r.subtitle ? `${r.title}, ${r.subtitle}` : r.title
                    }
                    style={({pressed}) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}>
                    {r.art}
                    <View style={styles.text}>
                      <Text style={styles.title} numberOfLines={1}>
                        {r.title}
                      </Text>
                      {r.subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {r.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Feather
                      name="chevron-right"
                      size={moderateScale(18)}
                      color={Color(theme.colors.text).alpha(0.35).string()}
                      style={flipX}
                    />
                  </Pressable>
                </View>
              ))}
              {more > 0 ? (
                <>
                  <View style={styles.separator} />
                  <Pressable
                    onPress={group.seeAll}
                    accessibilityRole="button"
                    style={({pressed}) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}>
                    <Text style={styles.seeAll}>
                      {t('collectionScreen.search.seeAll', {
                        total: localizeDigits(group.results.length),
                        name: group.label,
                      })}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    root: {gap: '18@ms'},
    // Runs edge to edge under the 16pt screen margin.
    chipsScroller: {marginHorizontal: '-16@ms'},
    chips: {flexDirection: 'row', gap: '6@ms', paddingHorizontal: '16@ms'},
    chip: {
      paddingHorizontal: '12@ms',
      paddingVertical: '6@ms',
      borderRadius: '999@ms',
      backgroundColor: Color(theme.colors.text).alpha(0.06).string(),
    },
    chipOn: {backgroundColor: theme.colors.text},
    chipText: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '12.5@ms',
      color: theme.colors.text,
    },
    chipTextOn: {color: theme.colors.background},
    // @ai-start: the Settings grouped-list look
    section: {gap: GROUPED_HEADER_GAP},
    sectionLabel: {
      ...groupedHeaderStyle(theme),
      marginStart: SETTINGS_ROW_INSET,
    },
    card: {
      borderRadius: GROUPED_CARD_RADIUS,
      overflow: 'hidden',
      backgroundColor: groupedCardColor(theme),
    },
    // @ai-end
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
      minHeight: '58@ms',
      paddingVertical: '9@ms',
      paddingHorizontal: SETTINGS_ROW_INSET, // @ai
    },
    rowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).string(),
    },
    face: {width: '40@ms', height: '40@ms', borderRadius: '20@ms'},
    text: {flex: 1, minWidth: 0},
    title: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '14.5@ms',
      color: theme.colors.text,
    },
    subtitle: {
      fontFamily: theme.fonts.regular,
      fontSize: '12@ms',
      color: theme.colors.textSecondary,
      marginTop: '1@ms',
    },
    seeAll: {
      fontFamily: theme.fonts.semiBold,
      fontSize: '13.5@ms',
      color: theme.colors.text,
    },
    separator: {
      height: StyleSheet.hairlineWidth, // @ai
      marginStart: '70@ms',
      marginEnd: SETTINGS_ROW_INSET, // @ai
      backgroundColor: groupedSeparatorColor(theme), // @ai
    },
    empty: {
      fontFamily: theme.fonts.medium,
      fontSize: '14@ms',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: '20@ms',
      paddingHorizontal: '24@ms',
    },
  });
