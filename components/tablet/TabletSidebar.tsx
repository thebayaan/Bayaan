import React, {useCallback, useMemo, useRef} from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent, // @ai
  type ScrollViewInstance,
} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {
  HomeIcon,
  QuranIcon,
  SearchIcon,
  CollectionIcon,
  SettingsIcon,
  LogoIcon,
  // @ai-start
  TasbihIcon,
  HeartIcon,
  DownloadIcon,
  PlaylistIcon,
  ProfileIcon,
  MicrophoneIcon,
  // @ai-end
} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {TabletDockedPlayer} from '@/components/tablet/TabletDockedPlayer';
// @ai-start
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import branding from '@/config/branding';
import {appLayoutDirection, flipX, isRTL} from '@/utils/rtl';
import {useTabletSidebarStore} from '@/store/tabletSidebarStore';
import {
  LIBRARY_SECTIONS,
  TOP_ITEMS,
  canShowSidebar,
  selectedSidebarItem,
  sidebarMode,
  sidebarPress,
  sidebarWidth,
  type SidebarItemId,
} from '@/components/tablet/sidebarNav';
import {router, useIsFocused, type Href} from 'expo-router';
import {useHover} from '@/hooks/useHover';
import {useKeyCommands} from '@/hooks/useKeyCommands';
import type {KeyBinding} from '@/services/keyboard/keyCommands';
import {requestSearchFocus} from '@/services/keyboard/searchFocus';
// @ai-end

// Text in the sidebar grows with Dynamic Type only this far, so the labels
// still fit its width. @ai
const MAX_FONT_SCALE = 1.3; // @ai

// ⌘1–⌘4 for the items at the top, ⌘5 for Collection (ipad-standards §7.3). @ai
const NUMBER_KEYS = ['cmd-1', 'cmd-2', 'cmd-3', 'cmd-4'] as const; // @ai

// @ai-start
function ItemIcon({
  id,
  selected,
  color,
  size,
}: {
  id: SidebarItemId;
  selected: boolean;
  color: string;
  size: number;
}) {
  switch (id) {
    case 'home':
      return <HomeIcon filled={selected} color={color} size={size} />;
    case 'quran':
      return <QuranIcon filled={selected} color={color} size={size * 1.2} />;
    case 'search':
      return <SearchIcon filled={selected} color={color} size={size} />;
    case 'adhkar':
      return <TasbihIcon color={color} size={size} />;
    case 'library':
      return <CollectionIcon filled={selected} color={color} size={size} />;
    case 'settings':
      return <SettingsIcon filled={selected} color={color} size={size} />;
    case 'loved':
      return <HeartIcon filled={selected} color={color} size={size} />;
    case 'downloads':
      return <DownloadIcon color={color} size={size} />;
    case 'bookmarks':
      return <Feather name="bookmark" color={color} size={size} />;
    case 'notes':
      return <Feather name="file-text" color={color} size={size} />;
    case 'playlists':
      return <PlaylistIcon color={color} size={size} />;
    case 'reciters':
      return <ProfileIcon filled={selected} color={color} size={size} />;
    case 'uploads':
      return <MicrophoneIcon color={color} size={size} />;
  }
}
// @ai-end

interface SidebarItemProps {
  id: SidebarItemId; // @ai
  label: string;
  selected: boolean; // @ai
  onPress: (id: SidebarItemId) => void; // @ai
  theme: Theme;
  showLabel: boolean;
}

// @ai-start
const SidebarItem = React.memo(function SidebarItem({
  id,
  label,
  selected,
  onPress,
  theme,
  showLabel,
}: SidebarItemProps) {
  const {hovered, hoverProps} = useHover();
  const activeBg = Color(theme.colors.text).alpha(0.08).toString();
  const pressedBg = Color(theme.colors.text).alpha(0.06).toString();
  const hoverBg = Color(theme.colors.text).alpha(0.04).toString();
  const iconColor = selected
    ? theme.colors.text
    : Color(theme.colors.text).alpha(0.55).toString();
  const labelColor = selected
    ? Color(theme.colors.text).alpha(0.95).toString()
    : Color(theme.colors.text)
        .alpha(showLabel ? 0.8 : 0.65)
        .toString();
  const fontFamily = selected ? 'Manrope-SemiBold' : 'Manrope-Medium';

  return (
    <Pressable
      {...hoverProps}
      onPress={() => onPress(id)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{selected}}
      style={({pressed}) => [
        styles.item,
        showLabel ? styles.itemRow : styles.itemCol,
        selected && {backgroundColor: activeBg},
        hovered && !selected && {backgroundColor: hoverBg},
        pressed && !selected && {backgroundColor: pressedBg},
      ]}>
      <View style={showLabel ? styles.iconBox : styles.iconBoxRail}>
        <ItemIcon
          id={id}
          selected={selected}
          color={iconColor}
          size={showLabel ? 22 : 24}
        />
      </View>
      <Text
        style={[
          showLabel ? styles.labelInline : styles.labelStacked,
          {color: labelColor, fontFamily},
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
});
// @ai-end

/**
 * The iPad sidebar (ipad-standards §6). From 900pt wide it is labelled and
 * lists Collection's sections directly; narrower, or when the reader
 * collapses it, it is the icon rail. The mini player docks in its footer.
 */
// @ai-start
export const TabletSidebar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  emitter,
}) => {
  const {theme, isDarkMode} = useTheme();
  const {t} = useTranslation(['common', 'collection']);
  const insets = useSafeAreaInsets();
  const {width} = useResponsive();
  const collapsed = useTabletSidebarStore(s => s.collapsed);
  const toggleCollapsed = useTabletSidebarStore(s => s.toggleCollapsed);
  const mode = sidebarMode(width, collapsed);
  const labelled = mode === 'sidebar';
  const barWidth = sidebarWidth(width, mode);
  const selected = selectedSidebarItem(state, mode);

  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  const labels = useMemo<Record<SidebarItemId, string>>(
    () => ({
      home: t('tabs.home'),
      quran: t('tabs.surahs'),
      search: t('tabs.search'),
      adhkar: t('terms.adhkar'),
      library: t('tabs.collection'),
      settings: t('tabs.settings'),
      loved: t('collection:collectionScreen.loved'),
      downloads: t('terms.downloads'),
      bookmarks: t('terms.bookmarks'),
      notes: t('collection:collectionScreen.notes'),
      playlists: t('terms.playlists'),
      reciters: t('terms.reciters'),
      uploads: t('terms.uploads'),
    }),
    [t],
  );

  // A short window (the iPad mini in landscape) can't fit every section, and
  // a list cut off between two rows looks complete. Flash the scroll
  // indicator whenever the list gets taller than the space it has.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollSize = useRef({viewport: 0, content: 0, flashed: false});
  const checkOverflow = useCallback(() => {
    const size = scrollSize.current;
    const overflows = size.viewport > 0 && size.content > size.viewport + 1;
    if (overflows && !size.flashed) scrollRef.current?.flashScrollIndicators();
    size.flashed = overflows;
  }, []);
  const handleScrollLayout = useCallback(
    (e: LayoutChangeEvent) => {
      scrollSize.current.viewport = e.nativeEvent.layout.height;
      checkOverflow();
    },
    [checkOverflow],
  );
  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      scrollSize.current.content = height;
      checkOverflow();
    },
    [checkOverflow],
  );

  const handlePress = useCallback(
    (item: SidebarItemId) => {
      const press = sidebarPress(state, item);
      if (press.tabPress) {
        const event = emitter.emit({
          type: 'tabPress',
          target: press.tabPress,
          canPreventDefault: true,
        });
        if (event.defaultPrevented) return;
      }
      // Expo Router 58 gives a tab bar no navigation prop. Each tab's
      // descriptor still carries the tab navigator's, which handles these.
      const {navigation} = descriptors[state.routes[state.index].key];
      press.actions.forEach(action => navigation.dispatch(action));
      if (press.open) {
        router.navigate(press.open.href as Href, {
          withAnchor: press.open.withAnchor,
        });
      }
    },
    [state, descriptors, emitter],
  );

  // Keyboard: ⌘1–⌘5 press the items, ⌘F opens Search with the cursor in
  // its field. Only while the tabs are on show, not under the reader.
  const tabsOnShow = useIsFocused();
  const keyBindings = useMemo<KeyBinding[]>(
    () => [
      ...TOP_ITEMS.map(
        (id, i): KeyBinding => ({
          key: NUMBER_KEYS[i],
          title: labels[id],
          menu: 'go',
          run: () => handlePress(id),
        }),
      ),
      {
        key: 'cmd-5',
        title: labels.library,
        menu: 'go',
        run: () => handlePress('library'),
      },
      {
        key: 'cmd-f',
        title: t('keyboard.findSurahOrReciter'),
        menu: 'go',
        run: () => {
          handlePress('search');
          requestSearchFocus();
        },
      },
    ],
    [labels, t, handlePress],
  );
  useKeyCommands(keyBindings, tabsOnShow);

  const containerStyle = useMemo(
    () => [
      styles.container,
      appLayoutDirection,
      {
        width: barWidth,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 8,
        paddingStart: Math.max(isRTL ? insets.right : insets.left, 8),
        backgroundColor: isDarkMode
          ? Color(theme.colors.background).lighten(0.05).toString()
          : Color(theme.colors.background).darken(0.02).toString(),
        borderEndColor: Color(theme.colors.text).alpha(0.08).toString(),
      },
    ],
    [
      barWidth,
      insets.top,
      insets.bottom,
      insets.left,
      insets.right,
      isDarkMode,
      theme.colors.background,
      theme.colors.text,
    ],
  );

  const mutedColor = Color(theme.colors.text).alpha(0.55).toString();
  const toggleHover = useHover();
  const toggleButton = canShowSidebar(width) ? (
    <Pressable
      {...toggleHover.hoverProps}
      onPress={toggleCollapsed}
      accessibilityRole="button"
      accessibilityLabel={
        labelled ? t('actions.hideSidebar') : t('actions.showSidebar')
      }
      hitSlop={4}
      style={({pressed}) => [
        styles.toggle,
        toggleHover.hovered && {
          backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
        },
        pressed && {
          backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
        },
      ]}>
      <Feather name="sidebar" size={20} color={mutedColor} style={flipX} />
    </Pressable>
  ) : null;

  const item = (id: SidebarItemId) => (
    <SidebarItem
      key={id}
      id={id}
      label={labels[id]}
      selected={selected === id}
      onPress={handlePress}
      theme={theme}
      showLabel={labelled}
    />
  );

  return (
    <View style={containerStyle}>
      {labelled ? (
        <View style={[styles.header, styles.headerLabelled]}>
          <LogoIcon
            color={theme.colors.text}
            size={32}
            isDarkMode={isDarkMode}
          />
          <Text
            style={[styles.brand, {color: theme.colors.text}]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {branding.appName}
          </Text>
          {toggleButton}
        </View>
      ) : (
        <View style={styles.header}>
          <LogoIcon
            color={theme.colors.text}
            size={40}
            isDarkMode={isDarkMode}
          />
          {toggleButton}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.items}
        onLayout={handleScrollLayout}
        onContentSizeChange={handleContentSizeChange}>
        {TOP_ITEMS.map(item)}
        {labelled ? (
          <>
            <Text
              accessibilityRole="header"
              style={[
                styles.sectionHeader,
                // Spacing letters apart breaks up Arabic script.
                {color: mutedColor, letterSpacing: isRTL ? 0 : 0.6},
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {labels.library}
            </Text>
            {LIBRARY_SECTIONS.map(section => item(section.id))}
          </>
        ) : (
          item('library')
        )}
      </ScrollView>

      <View style={styles.bottom}>{item('settings')}</View>

      {hasTrack ? (
        <View style={styles.footer}>
          <TabletDockedPlayer expanded={labelled} />
        </View>
      ) : null}
    </View>
  );
};
// @ai-end

// @ai-start
const styles = StyleSheet.create({
  container: {
    height: '100%',
    borderEndWidth: StyleSheet.hairlineWidth,
    paddingEnd: 8,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  headerLabelled: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingStart: 12,
    paddingVertical: 4,
  },
  brand: {
    flex: 1,
    fontFamily: 'Manrope-SemiBold',
    fontSize: 18,
  },
  toggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  items: {
    gap: 4,
  },
  item: {
    borderRadius: 12,
  },
  itemCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    paddingVertical: 8,
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  iconBox: {
    width: 28,
    alignItems: 'center',
  },
  iconBoxRail: {
    height: 30,
    justifyContent: 'center',
  },
  labelStacked: {
    fontSize: 11,
  },
  labelInline: {
    flex: 1,
    fontSize: 17,
  },
  sectionHeader: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    paddingTop: 16,
    paddingBottom: 4,
    paddingHorizontal: 12,
  },
  bottom: {
    paddingTop: 8,
  },
  footer: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
});
// @ai-end
