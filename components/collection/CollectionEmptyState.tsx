// @ai-generated
import React, {useMemo} from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useRouter} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useLibraryListBottomPadding} from '@/hooks/useBottomInset';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {flipX} from '@/utils/rtl';
import {
  CATEGORY_COLORS,
  type CollectionCategoryId,
} from '@/components/collection/CollectionArt';
import {
  CollectionScreenHeader,
  type CollectionHeaderButton,
} from '@/components/collection/CollectionScreenHeader';
import {
  PANEL_ART_RADIUS,
  PANEL_ART_SIZE,
  PANEL_MARGIN,
  PANEL_RADIUS,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PANEL_ART_GAP,
  usePanelColor,
} from '@/components/collection/CollectionPanel';

/**
 * A Collection screen before it has anything in it. It keeps the full
 * screen's frame (the glass icon where the cover goes, a summary of what's
 * missing, the big title) so nothing jumps when the first item arrives.
 * Under it, the panel shows three faint rows in the category's colour
 * that fade into a message saying how to add something, and either a
 * quiet link or, in the header, the one action that creates something.
 */
export function CollectionEmptyState({
  category,
  title,
  meta,
  heading,
  message,
  primary,
  link,
  showBack,
}: {
  category: CollectionCategoryId;
  title: string;
  meta: string;
  heading: string;
  message: string;
  /** The dark button, where the screen can create something. */
  primary?: CollectionHeaderButton;
  /** A quiet link inside the panel, where it can't. */
  link?: {label: string; onPress: () => void};
  /** Draw a back button (only without the native header). */
  showBack?: boolean;
}) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const bottom = useLibraryListBottomPadding();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingBottom: bottom}}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <CollectionScreenHeader
        category={category}
        preview={null}
        title={title}
        meta={meta}
        primary={primary}
        actions={
          showBack && !USE_GLASS ? (
            <View style={styles.backRow}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                accessibilityRole="button">
                <Feather
                  name="arrow-left"
                  size={moderateScale(22)}
                  color={theme.colors.text}
                  style={flipX}
                />
              </Pressable>
            </View>
          ) : undefined
        }
      />
      <CollectionEmptyPanel
        category={category}
        heading={heading}
        message={message}
        link={link}
        style={{marginTop: primary ? 0 : moderateScale(4)}}
      />
    </ScrollView>
  );
}

/**
 * The panel part of an empty Collection screen on its own: three faint
 * rows in the category's colour fading into a heading, a line on how to
 * add something and an optional link. Also used inside other screens,
 * such as a reciter's My Uploads tab.
 */
export function CollectionEmptyPanel({
  category,
  heading,
  message,
  link,
  style,
}: {
  category: CollectionCategoryId;
  heading: string;
  message: string;
  link?: {label: string; onPress: () => void};
  style?: StyleProp<ViewStyle>;
}) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const panel = usePanelColor();
  const color = CATEGORY_COLORS[category];
  const ghost = Color(theme.colors.text)
    .alpha(theme.isDarkMode ? 0.09 : 0.07)
    .string();
  const art = Color(color)
    .alpha(theme.isDarkMode ? 0.22 : 0.16)
    .string();
  const separator = Color(theme.colors.text).alpha(0.12).string();
  // The link takes the category colour, a little darker on light so it
  // reads as text.
  const linkColor = theme.isDarkMode
    ? Color(color).lighten(0.15).string()
    : Color(color).darken(0.25).string();
  return (
    <View style={[styles.panel, {backgroundColor: panel}, style]}>
      {[1, 0.6, 0.3].map((opacity, i) => (
        <View
          key={i}
          style={[styles.ghostRow, {opacity}]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden>
          {i > 0 ? (
            <View style={[styles.separator, {backgroundColor: separator}]} />
          ) : null}
          <View style={[styles.ghostArt, {backgroundColor: art}]} />
          <View style={styles.ghostLines}>
            <View
              style={[styles.ghostLine, {width: '58%', backgroundColor: ghost}]}
            />
            <View
              style={[styles.ghostLine, {width: '36%', backgroundColor: ghost}]}
            />
          </View>
        </View>
      ))}
      <View style={styles.message}>
        <Text style={styles.heading} accessibilityRole="header">
          {heading}
        </Text>
        <Text style={styles.body}>{message}</Text>
        {link ? (
          <Pressable
            onPress={link.onPress}
            hitSlop={8}
            accessibilityRole="link"
            style={({pressed}) => pressed && {opacity: 0.6}}>
            <Text style={[styles.link, {color: linkColor}]}>{link.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    backRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    panel: {
      marginHorizontal: PANEL_MARGIN,
      borderRadius: PANEL_RADIUS,
      borderCurve: 'continuous',
      overflow: 'hidden',
      paddingBottom: '22@ms',
    },
    ghostRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: PANEL_ROW_VERTICAL,
      paddingHorizontal: PANEL_ROW_PADDING,
    },
    separator: {
      position: 'absolute',
      top: 0,
      start: PANEL_ROW_PADDING + PANEL_ART_SIZE + PANEL_ART_GAP,
      end: 0,
      height: 0.5,
    },
    ghostArt: {
      width: PANEL_ART_SIZE,
      height: PANEL_ART_SIZE,
      borderRadius: PANEL_ART_RADIUS,
      borderCurve: 'continuous',
      marginEnd: PANEL_ART_GAP,
    },
    ghostLines: {
      flex: 1,
      gap: '8@ms',
    },
    ghostLine: {
      height: '9@ms',
      borderRadius: '4.5@ms',
    },
    message: {
      alignItems: 'center',
      paddingHorizontal: '28@ms',
      paddingTop: '6@ms',
      gap: '6@ms',
    },
    heading: {
      fontFamily: theme.fonts.extraBold,
      fontSize: '17@ms',
      color: theme.colors.text,
      textAlign: 'center',
    },
    body: {
      fontFamily: theme.fonts.regular,
      fontSize: '14@ms',
      lineHeight: '20@ms',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    link: {
      marginTop: '6@ms',
      fontFamily: theme.fonts.bold,
      fontSize: '15@ms',
    },
  });
