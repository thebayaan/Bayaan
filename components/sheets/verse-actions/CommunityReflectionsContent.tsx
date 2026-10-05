/**
 * RFC-018 — fullscreen community-reflections popup inside VerseActionsSheet.
 *
 * Opened by the "Community Reflections" row in the action sheet's EXPLORE
 * group (long-press an ayah). Unlike the inline slot
 * (`branding.ayahCommunityReflectionsComponent`, which a fork renders with
 * its own card styling), this popup is a GENERIC upstream list driven only by
 * the existing `branding.communityReflectionsProvider` field — no extra seam
 * (per RFC-018 §4). It renders the typed `CommunityReflection[]` directly.
 *
 * The action-sheet row is gated on `branding.communityReflectionsProvider`,
 * so Bayaan (no provider) never reaches this screen; the early-return below
 * is purely defensive.
 *
 * See docs/rfcs/018-community-reflections-provider.md.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from 'react-native-size-matters';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import branding from '@/config/branding';
import type {CommunityReflection} from '@/types/CommunityReflection';

interface CommunityReflectionsContentProps {
  surahNumber: number;
  ayahNumber: number;
}

type FetchState =
  | {kind: 'loading'}
  | {kind: 'loaded'; data: CommunityReflection[]}
  | {kind: 'error'};

export const CommunityReflectionsContent: React.FC<
  CommunityReflectionsContentProps
> = ({surahNumber, ayahNumber}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const verseKey = `${surahNumber}:${ayahNumber}`;
  const [state, setState] = useState<FetchState>({kind: 'loading'});

  useEffect(() => {
    const provider = branding.communityReflectionsProvider;
    if (!provider) {
      // Bayaan (no provider) never reaches this screen — the EXPLORE row is
      // gated — but stay defensive.
      setState({kind: 'loaded', data: []});
      return;
    }
    let cancelled = false;
    setState({kind: 'loading'});
    // `locale` is intentionally omitted: stock Bayaan has no reliable BCP-47
    // source (translation-edition ids don't map to language tags), so we lean
    // on the contract's `undefined → provider's own default`.
    provider(surahNumber, ayahNumber)
      .then(data => {
        if (cancelled) return;
        setState({kind: 'loaded', data});
      })
      .catch(() => {
        if (cancelled) return;
        setState({kind: 'error'});
      });
    return () => {
      cancelled = true;
    };
  }, [surahNumber, ayahNumber]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        <View style={styles.verseBadge}>
          <Text style={styles.verseBadgeText}>{verseKey}</Text>
        </View>

        {state.kind === 'loading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.text} />
          </View>
        ) : state.kind === 'error' ? (
          <Text style={styles.emptyText}>
            Couldn’t load reflections. Try again later.
          </Text>
        ) : state.data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather
              name="message-square"
              size={moderateScale(28)}
              color={Color(theme.colors.text).alpha(0.2).toString()}
            />
            <Text style={styles.emptyTitle}>No reflections yet</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              {state.data.length}{' '}
              {state.data.length === 1 ? 'REFLECTION' : 'REFLECTIONS'}
            </Text>
            <View style={styles.reflectionList}>
              {state.data.map(r => (
                <ReflectionRow
                  key={r.id}
                  reflection={r}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

interface ReflectionRowProps {
  reflection: CommunityReflection;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

function ReflectionRow({reflection, styles, theme}: ReflectionRowProps) {
  // Community-authored URL supplied by a fork's provider — only web schemes
  // may reach Linking.openURL (blocks intent://, javascript:, file:, …).
  const isWebUrl = /^https?:\/\//i.test(reflection.url);
  const handleOpen = useCallback(() => {
    if (isWebUrl) Linking.openURL(reflection.url);
  }, [isWebUrl, reflection.url]);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${reflection.author.name}'s reflection`}
      disabled={!isWebUrl}
      style={({pressed}) => [
        styles.reflectionCard,
        pressed && styles.reflectionCardPressed,
      ]}
      onPress={handleOpen}>
      <View style={styles.reflectionHeader}>
        <Text style={styles.authorName} numberOfLines={1}>
          {reflection.author.name}
        </Text>
        {reflection.author.verified && (
          <Feather
            name="check-circle"
            size={moderateScale(12)}
            color={Color(theme.colors.text).alpha(0.6).toString()}
          />
        )}
      </View>
      <Text style={styles.reflectionBody}>{reflection.body.trim()}</Text>
      <View style={styles.metaRow}>
        {reflection.likesCount > 0 && (
          <View style={styles.metaItem}>
            <Feather
              name="heart"
              size={moderateScale(11)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.metaText}>{reflection.likesCount}</Text>
          </View>
        )}
        {reflection.commentsCount > 0 && (
          <View style={styles.metaItem}>
            <Feather
              name="message-circle"
              size={moderateScale(11)}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.metaText}>{reflection.commentsCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flex: 1,
    },
    scrollInner: {
      paddingTop: verticalScale(16),
      paddingBottom: verticalScale(24),
    },
    verseBadge: {
      alignSelf: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
      borderRadius: moderateScale(8),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(4),
      marginBottom: verticalScale(14),
    },
    verseBadgeText: {
      fontSize: moderateScale(11.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.7).toString(),
      letterSpacing: 0.3,
    },
    loadingContainer: {
      paddingVertical: verticalScale(40),
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: verticalScale(40),
      alignItems: 'center',
      gap: moderateScale(10),
      paddingHorizontal: moderateScale(20),
    },
    emptyTitle: {
      fontSize: moderateScale(15),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.7).toString(),
      marginTop: verticalScale(4),
    },
    emptyText: {
      fontSize: moderateScale(13),
      fontFamily: 'Manrope-Regular',
      color: Color(theme.colors.textSecondary).alpha(0.55).toString(),
      textAlign: 'center',
      lineHeight: moderateScale(19),
      paddingVertical: verticalScale(40),
    },
    sectionLabel: {
      fontSize: moderateScale(10.5),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.textSecondary).alpha(0.5).toString(),
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: verticalScale(10),
      paddingHorizontal: moderateScale(16),
    },
    reflectionList: {
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
    },
    reflectionCard: {
      paddingVertical: moderateScale(12),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(12),
      backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    reflectionCardPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    reflectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      marginBottom: verticalScale(6),
    },
    authorName: {
      fontSize: moderateScale(13),
      color: theme.colors.text,
      fontFamily: 'Manrope-SemiBold',
      flexShrink: 1,
    },
    reflectionBody: {
      fontSize: moderateScale(13.5),
      lineHeight: moderateScale(20),
      color: theme.colors.text,
      fontFamily: 'Manrope-Regular',
    },
    metaRow: {
      flexDirection: 'row',
      gap: moderateScale(14),
      marginTop: verticalScale(10),
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(4),
    },
    metaText: {
      fontSize: moderateScale(11.5),
      color: theme.colors.textSecondary,
      fontFamily: 'Manrope-Regular',
    },
  });
