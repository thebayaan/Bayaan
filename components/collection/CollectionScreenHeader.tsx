// @ai-generated
import React, {useEffect, useMemo, useState} from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Feather, MaterialIcons} from '@expo/vector-icons';
import {SymbolView} from 'expo-symbols';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {moderateScale, ScaledSheet} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import {NativeMenu} from '@/components/native/NativeMenu';
import {nativeMenusAvailable} from '@/components/native/nativeMenus';
import type {NativeMenuEntry} from '@/components/native/menuTypes';
import {
  CollectionPreview,
  type CollectionCategoryId,
  type CollectionPreviewData,
} from '@/components/collection/CollectionArt';
import {
  COLLECTION_HAS_VIEW,
  COLLECTION_SORTS,
  useCollectionViewPref,
  type CollectionScreenKey,
} from '@/store/collectionViewStore';

export interface CollectionHeaderButton {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  /** Draws a native menu over the button instead of handling the press. */
  menu?: React.ReactNode;
  disabled?: boolean;
}

interface CollectionScreenHeaderProps {
  category: CollectionCategoryId;
  preview: CollectionPreviewData;
  title: string;
  meta?: string;
  primary?: CollectionHeaderButton;
  secondary?: CollectionHeaderButton[];
  /** Search, sort and ••• on Android, where there's no native header. */
  actions?: React.ReactNode;
  /** Shown under the buttons, e.g. the Downloads switch. */
  children?: React.ReactNode;
}

/**
 * The top of every screen behind a Collection row, laid out like the
 * reciter page: the category's preview with a stats line, a large title,
 * the main action as a wide button, then smaller outlined buttons.
 */
export function CollectionScreenHeader({
  category,
  preview,
  title,
  meta,
  primary,
  secondary,
  actions,
  children,
}: CollectionScreenHeaderProps) {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: USE_GLASS
            ? moderateScale(8)
            : insets.top + moderateScale(6),
        },
      ]}>
      {!USE_GLASS && actions ? (
        <View style={styles.actionsRow}>{actions}</View>
      ) : null}
      <View style={styles.metaRow}>
        <CollectionPreview
          category={category}
          data={preview}
          size={moderateScale(48)}
        />
        {meta ? (
          <Text style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      {primary || (secondary && secondary.length > 0) ? (
        <View style={styles.buttons}>
          {primary ? (
            <Pressable
              onPress={primary.onPress}
              disabled={primary.disabled}
              accessibilityRole="button"
              accessibilityLabel={primary.label}
              style={({pressed}) => [
                styles.primary,
                (pressed || primary.disabled) && styles.pressed,
              ]}>
              {primary.icon}
              <Text style={styles.primaryText}>{primary.label}</Text>
            </Pressable>
          ) : null}
          {secondary && secondary.length > 0 ? (
            <View style={styles.row}>
              {secondary.map(button => (
                <Pressable
                  key={button.label}
                  onPress={button.onPress}
                  disabled={button.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={button.label}
                  style={({pressed}) => [
                    styles.secondary,
                    (pressed || button.disabled) && styles.pressed,
                  ]}>
                  {button.icon}
                  <Text style={styles.secondaryText} numberOfLines={1}>
                    {button.label}
                  </Text>
                  {button.menu}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** The labels of every sort the Collection screens offer. */
function useSortLabels(screen: CollectionScreenKey) {
  const {t} = useTranslation('collection');
  return (id: string): string => {
    switch (id) {
      case 'recent':
        return screen === 'loved'
          ? t('collectionScreen.sort.dateLoved')
          : screen === 'downloads'
            ? t('collectionScreen.sort.dateDownloaded')
            : screen === 'reciters'
              ? t('collectionScreen.sort.dateAdded')
              : t('collectionScreen.sort.newest');
      case 'oldest':
        return t('collectionScreen.sort.oldest');
      case 'surah':
        return t('collectionScreen.sort.surahOrder');
      case 'reciter':
        return t('collectionScreen.sort.reciter');
      case 'title':
        return t('collectionScreen.sort.title');
      case 'updated':
        return t('collectionScreen.sort.updated');
      case 'created':
        return t('collectionScreen.sort.dateCreated');
      case 'size':
        return t('collectionScreen.sort.size');
      case 'name':
        return t('collectionScreen.sort.name');
      default:
        return id;
    }
  };
}

/**
 * The buttons at the top right of a Collection screen: search, then the
 * view and sort menu (Grid or List, then Sort by), then anything extra
 * such as the ••• menu.
 */
export function CollectionHeaderActions({
  screen,
  onSearch,
  extra,
}: {
  screen: CollectionScreenKey;
  onSearch?: () => void;
  extra?: React.ReactNode;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation(['collection', 'common']);
  const {view, sort, setView, setSort} = useCollectionViewPref(screen);
  const sortLabel = useSortLabels(screen);
  const hasView = COLLECTION_HAS_VIEW[screen];

  const entries = useMemo<NativeMenuEntry[]>(() => {
    const list: NativeMenuEntry[] = [];
    if (hasView) {
      list.push({
        id: 'view',
        items: [
          {
            id: 'view:grid',
            title: t('collectionScreen.view.grid'),
            systemImage: 'square.grid.2x2',
            checked: view === 'grid',
          },
          {
            id: 'view:list',
            title: t('collectionScreen.view.list'),
            systemImage: 'list.bullet',
            checked: view === 'list',
          },
        ],
      });
    }
    list.push({
      id: 'sort',
      title: t('collectionScreen.view.sortBy'),
      items: COLLECTION_SORTS[screen].map(id => ({
        id: `sort:${id}`,
        title: sortLabel(id),
        checked: sort === id,
      })),
    });
    return list;
    // sortLabel is rebuilt each render; the labels follow `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasView, view, sort, screen, t]);

  const onSelect = (id: string) => {
    const [kind, value] = id.split(':');
    if (kind === 'view' && (value === 'grid' || value === 'list')) {
      setView(value);
    } else if (kind === 'sort' && value) {
      setSort(value);
    }
  };

  const iconSize = moderateScale(20);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(20),
        paddingHorizontal: moderateScale(6),
      }}>
      {onSearch ? (
        <Pressable
          onPress={onSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.search')}>
          <Feather name="search" size={iconSize} color={theme.colors.text} />
        </Pressable>
      ) : null}
      {nativeMenusAvailable ? (
        <NativeMenu
          entries={entries}
          onSelect={onSelect}
          accessibilityLabel={t('collectionScreen.view.menuLabel')}>
          {/* Apple Music's view-and-sort glyph. */}
          {Platform.OS === 'ios' ? (
            <SymbolView
              name="line.3.horizontal.decrease"
              size={iconSize}
              tintColor={theme.colors.text}
              weight="medium"
            />
          ) : (
            <MaterialIcons
              name="sort"
              size={iconSize}
              color={theme.colors.text}
            />
          )}
        </NativeMenu>
      ) : null}
      {extra}
    </View>
  );
}

/**
 * The search field that takes the header's place while searching, with a
 * Cancel button, as on the reciter page.
 */
export function CollectionSearchField({
  value,
  onChangeText,
  onCancel,
  placeholder,
  resultLabel,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onCancel?: () => void;
  placeholder: string;
  /** "2 of 8 bookmarks", under the field. */
  resultLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const {theme} = useTheme();
  const {t} = useTranslation('common');
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The field keeps its own text so fast typing never waits on the screen
  // re-rendering (a late `value` would move the cursor and mix letters).
  // A change from outside, such as Clear, still comes through.
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(current => (current === value ? current : value));
  }, [value]);
  const change = (next: string) => {
    setText(next);
    onChangeText(next);
  };
  return (
    <View style={style}>
      <View style={styles.searchRow}>
        <View style={styles.field}>
          <Feather
            name="search"
            size={moderateScale(16)}
            color={theme.colors.textSecondary}
          />
          <TextInput
            autoFocus={Boolean(onCancel)}
            value={text}
            onChangeText={change}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel={placeholder}
          />
          {text.length > 0 ? (
            <Pressable
              onPress={() => change('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('actions.clear')}>
              <Feather
                name="x-circle"
                size={moderateScale(16)}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>
        {onCancel ? (
          <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
            <Text style={styles.cancel}>{t('actions.cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
      {resultLabel ? (
        <Text style={styles.resultLabel}>{resultLabel}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      alignItems: 'stretch',
      paddingHorizontal: '16@ms',
      paddingBottom: '12@ms',
      backgroundColor: theme.colors.background,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      height: '40@ms',
      alignItems: 'center',
      marginBottom: '6@ms',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10@ms',
    },
    meta: {
      flexShrink: 1,
      fontSize: '12@ms',
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    title: {
      fontSize: '32@ms',
      fontFamily: theme.fonts.extraBold,
      color: theme.colors.text,
      lineHeight: '38@ms',
      letterSpacing: -0.5,
      marginTop: '14@ms',
    },
    buttons: {
      paddingTop: '14@ms',
      gap: '8@ms',
    },
    primary: {
      height: '50@ms',
      borderRadius: '12@ms',
      backgroundColor: theme.colors.text,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8@ms',
    },
    primaryText: {
      fontSize: '15@ms',
      fontFamily: theme.fonts.extraBold,
      color: theme.colors.background,
    },
    row: {
      flexDirection: 'row',
      gap: '8@ms',
    },
    secondary: {
      flex: 1,
      height: '44@ms',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: Color(theme.colors.text).alpha(0.16).toString(),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5@ms',
      paddingHorizontal: '8@ms',
    },
    secondaryText: {
      flexShrink: 1,
      fontSize: '13@ms',
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    pressed: {opacity: 0.6},
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
    },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@ms',
      height: '40@ms',
      borderRadius: '12@ms',
      paddingHorizontal: '12@ms',
      backgroundColor: Color(theme.colors.text).alpha(0.07).toString(),
    },
    input: {
      flex: 1,
      fontSize: '15@ms',
      fontFamily: theme.fonts.medium,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    cancel: {
      // Arabic's Cancel sits tight to the field on gap alone.
      paddingStart: '4@ms',
      fontSize: '15@ms',
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    resultLabel: {
      fontSize: '12@ms',
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
      marginTop: '8@ms',
      marginStart: '4@ms',
    },
  });
