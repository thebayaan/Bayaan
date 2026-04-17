import React, {useCallback, useMemo} from 'react';
import {View, Pressable, Text, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {useResponsive} from '@/hooks/useResponsive';
import {
  HomeIcon,
  QuranIcon,
  SearchIcon,
  CollectionIcon,
  SettingsIcon,
  LogoIcon,
} from '@/components/Icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommonActions} from '@react-navigation/native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {TabletDockedPlayer} from '@/components/tablet/TabletDockedPlayer';

const RAIL_WIDTH_COMPACT = 88;
const RAIL_WIDTH_EXPANDED = 240;

function getIcon(
  routeName: string,
  isFocused: boolean,
  theme: Theme,
  iconSize: number,
) {
  const color = isFocused
    ? theme.colors.text
    : Color(theme.colors.text).alpha(0.55).toString();

  switch (routeName) {
    case '(a.home)':
      return <HomeIcon filled={isFocused} color={color} size={iconSize} />;
    case '(b.surahs)':
      return (
        <QuranIcon filled={isFocused} color={color} size={iconSize * 1.2} />
      );
    case '(b.search)':
      return <SearchIcon filled={isFocused} color={color} size={iconSize} />;
    case '(c.collection)':
      return (
        <CollectionIcon filled={isFocused} color={color} size={iconSize} />
      );
    case '(d.settings)':
      return <SettingsIcon filled={isFocused} color={color} size={iconSize} />;
    default:
      return null;
  }
}

interface SidebarItemProps {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  theme: Theme;
  iconSize: number;
  showLabel: boolean;
}

const SidebarItem = React.memo(function SidebarItem({
  routeName,
  label,
  isFocused,
  onPress,
  theme,
  iconSize,
  showLabel,
}: SidebarItemProps) {
  const activeBg = Color(theme.colors.text).alpha(0.08).toString();
  const pressedBg = Color(theme.colors.text).alpha(0.06).toString();
  const labelColor = isFocused
    ? Color(theme.colors.text).alpha(0.95).toString()
    : Color(theme.colors.text).alpha(0.65).toString();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.item,
        showLabel ? styles.itemRow : styles.itemCol,
        isFocused && {backgroundColor: activeBg},
        pressed && !isFocused && {backgroundColor: pressedBg},
      ]}>
      {getIcon(routeName, isFocused, theme, iconSize)}
      {showLabel ? (
        <Text
          style={[
            styles.labelInline,
            {
              color: labelColor,
              fontFamily: isFocused ? 'Manrope-SemiBold' : 'Manrope-Medium',
            },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      ) : (
        <Text
          style={[
            styles.labelStacked,
            {
              color: labelColor,
              fontFamily: isFocused ? 'Manrope-SemiBold' : 'Manrope-Medium',
            },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

export const TabletSidebar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const {theme, isDarkMode} = useTheme();
  const insets = useSafeAreaInsets();
  const {orientation} = useResponsive();
  const expanded = orientation === 'landscape';
  const railWidth = expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COMPACT;
  const iconSize = 24;

  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  const handlePress = useCallback(
    (route: (typeof state.routes)[number], index: number) => {
      const isFocused = state.index === index;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.dispatch(
          CommonActions.navigate({name: route.name, merge: true}),
        );
      }
    },
    [state.index, navigation],
  );

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        width: railWidth,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 8,
        paddingLeft: Math.max(insets.left, 8),
        backgroundColor: isDarkMode
          ? Color(theme.colors.background).lighten(0.05).toString()
          : Color(theme.colors.background).darken(0.02).toString(),
        borderRightColor: Color(theme.colors.text).alpha(0.08).toString(),
      },
    ],
    [
      railWidth,
      insets.top,
      insets.bottom,
      insets.left,
      isDarkMode,
      theme.colors.background,
      theme.colors.text,
    ],
  );

  return (
    <View style={containerStyle}>
      <View style={[styles.header, expanded && styles.headerExpanded]}>
        <LogoIcon
          color={theme.colors.text}
          size={40}
          isDarkMode={isDarkMode}
        />
        {expanded ? (
          <Text style={[styles.brand, {color: theme.colors.text}]}>Bayaan</Text>
        ) : null}
      </View>

      <View style={styles.items}>
        {state.routes.map((route, index) => {
          const {options} = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;
          const isFocused = state.index === index;

          return (
            <SidebarItem
              key={route.key}
              routeName={route.name}
              label={typeof label === 'string' ? label : ''}
              isFocused={isFocused}
              onPress={() => handlePress(route, index)}
              theme={theme}
              iconSize={iconSize}
              showLabel={expanded}
            />
          );
        })}
      </View>

      {hasTrack ? (
        <View style={styles.footer}>
          <TabletDockedPlayer expanded={expanded} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight: 8,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  headerExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  brand: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 18,
  },
  items: {
    flex: 1,
    gap: 4,
  },
  item: {
    borderRadius: 12,
  },
  itemCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 14,
  },
  labelStacked: {
    fontSize: 10,
  },
  labelInline: {
    fontSize: 14,
  },
  footer: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
});
