// @ai-generated
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useBottomInset} from '@/hooks/useBottomInset';
import {useDevSettingsStore} from '@/store/devSettingsStore';
import {useAnalyticsConsentStore} from '@/store/analyticsConsentStore';
import {ThemePicker} from '@/components/settings/ThemePicker';
import branding from '@/config/branding';
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {
  SETTINGS_PAGE_MAX_WIDTH,
  SETTINGS_ROUTE_NAMES,
  customIconMap,
  getSettingsSections,
  isExternalLink,
  openSettingsItem,
  settingsHref,
} from './settingsItems';

const ICON_TILE = 28;
const ROW_PADDING = 12;

interface RowProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  accessory?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  role?: 'button' | 'link';
}

function SettingsRow({
  title,
  description,
  icon,
  accessory,
  selected = false,
  onPress,
  role = 'button',
}: RowProps) {
  const {theme} = useTheme();
  const text = theme.colors.text;
  const body = (
    <>
      <View
        style={[
          styles.iconTile,
          {backgroundColor: Color(text).alpha(0.06).toString()},
        ]}>
        {icon}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.title, {color: text}]}>{title}</Text>
        {description ? (
          <Text
            style={[styles.description, {color: theme.colors.textSecondary}]}>
            {description}
          </Text>
        ) : null}
      </View>
      {accessory}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{selected}}
      style={({pressed}) => [
        styles.row,
        selected && {backgroundColor: Color(text).alpha(0.08).toString()},
        pressed &&
          !selected && {backgroundColor: Color(text).alpha(0.05).toString()},
      ]}>
      {body}
    </Pressable>
  );
}

function Group({children}: {children: React.ReactNode}) {
  const {theme} = useTheme();
  const text = theme.colors.text;
  const items = React.Children.toArray(children);
  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: Color(text).alpha(0.04).toString(),
          borderColor: Color(text).alpha(0.06).toString(),
        },
      ]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <View
              style={[
                styles.divider,
                {backgroundColor: Color(text).alpha(0.08).toString()},
              ]}
            />
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

function SectionHeader({children}: {children: string}) {
  const {theme} = useTheme();
  return (
    <Text
      style={[styles.sectionHeader, {color: theme.colors.textSecondary}]}
      accessibilityRole="header">
      {children}
    </Text>
  );
}

interface TabletSettingsListProps {
  /** Opens a page; the split swaps its page, a narrow window pushes it. */
  onOpenPage: (routeName: string) => void;
  /** The page shown beside the list, whose row is marked. */
  selectedRoute?: string;
}

/**
 * The Settings list on iPad (ipad-audit/settings, "Settings root"): a large
 * title, grouped rows at real point sizes with a 28pt icon tile, and the
 * page beside it marked when the list sits in a split.
 */
export function TabletSettingsList({
  onOpenPage,
  selectedRoute,
}: TabletSettingsListProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['settings', 'common']);
  const {showFloatingDevMenu, toggleFloatingDevMenu} = useDevSettingsStore();
  const {analyticsEnabled, setAnalyticsEnabled} = useAnalyticsConsentStore();
  const sections = getSettingsSections(t);
  const inSplit = selectedRoute !== undefined;
  const text = theme.colors.text;
  const secondary = theme.colors.textSecondary;
  const analyticsNote = t('settings:index.analytics.description', {
    appName: branding.appName,
  });
  const trackColor = {
    false: Color(text).alpha(0.1).toString(),
    true: Color(text).alpha(0.65).toString(),
  };

  const iconFor = (item: {icon: string; iconType: string}) => {
    const Custom = item.iconType === 'custom' ? customIconMap[item.icon] : null;
    return Custom ? (
      <Custom size={18} color={text} />
    ) : (
      <Feather
        name={item.icon as React.ComponentProps<typeof Feather>['name']}
        size={16}
        color={text}
      />
    );
  };

  return (
    <View>
      <Text
        style={[styles.screenTitle, {color: text}]}
        accessibilityRole="header">
        {t('common:tabs.settings')}
      </Text>

      <SectionHeader>{t('settings:index.appearance')}</SectionHeader>
      <ThemePicker />

      {sections.map(section => (
        <View key={section.section}>
          <SectionHeader>{section.section}</SectionHeader>
          <Group>
            {section.items.map(item => {
              const external = isExternalLink(item.type);
              const routeName = SETTINGS_ROUTE_NAMES[item.type];
              // Pages beside the list need no chevron; links keep their glyph.
              const showChevron = !external && !inSplit;
              return (
                <SettingsRow
                  key={item.type}
                  title={item.title}
                  description={inSplit ? undefined : item.description}
                  icon={iconFor(item)}
                  role={external ? 'link' : 'button'}
                  selected={!!routeName && routeName === selectedRoute}
                  onPress={() => openSettingsItem(item.type, onOpenPage)}
                  accessory={
                    external || showChevron ? (
                      <Feather
                        name={external ? 'external-link' : 'chevron-right'}
                        size={14}
                        color={secondary}
                        style={external ? undefined : flipX}
                      />
                    ) : null
                  }
                />
              );
            })}
          </Group>
        </View>
      ))}

      <SectionHeader>{t('settings:index.analytics.section')}</SectionHeader>
      <Group>
        <SettingsRow
          title={t('settings:index.analytics.title')}
          description={inSplit ? undefined : analyticsNote}
          icon={<Feather name="bar-chart-2" size={16} color={text} />}
          accessory={
            <Switch
              value={analyticsEnabled}
              onValueChange={setAnalyticsEnabled}
              trackColor={trackColor}
              thumbColor="#FFFFFF"
              ios_backgroundColor={trackColor.false}
              accessibilityLabel={t('settings:index.analytics.title')}
            />
          }
        />
      </Group>
      {inSplit ? (
        // The narrow list has no room beside the switch, so the note sits
        // under the group, as in iOS Settings.
        <Text style={[styles.footnote, {color: secondary}]}>
          {analyticsNote}
        </Text>
      ) : null}

      {__DEV__ && (
        // Dev-only tools stay in English.
        // i18next-instrument-ignore
        <View>
          <SectionHeader>DEVELOPER</SectionHeader>
          <Group>
            <SettingsRow
              title="Floating Dev Menu"
              icon={<Feather name="tool" size={16} color={text} />}
              accessory={
                <Switch
                  value={showFloatingDevMenu}
                  onValueChange={toggleFloatingDevMenu}
                  trackColor={trackColor}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={trackColor.false}
                />
              }
            />
          </Group>
        </View>
      )}
    </View>
  );
}

/** Scrolls the list within a pane, clear of the status bar and home indicator. */
export function TabletSettingsListPane(props: TabletSettingsListProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.paneContent,
        {paddingTop: insets.top + 16, paddingBottom: bottomInset + 24},
      ]}
      showsVerticalScrollIndicator={false}>
      <TabletSettingsList {...props} />
    </ScrollView>
  );
}

/**
 * The Settings screen on iPad windows too narrow for the split: the list in
 * the 640pt settings column, with each page pushed over it.
 */
export function TabletSettingsHome() {
  const router = useRouter();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  return (
    <View style={[styles.fill, {backgroundColor: theme.colors.background}]}>
      <ScrollView
        contentInsetAdjustmentBehavior={USE_GLASS ? 'automatic' : 'never'}
        contentContainerStyle={[
          styles.homeContent,
          {
            paddingTop: USE_GLASS ? 16 : insets.top + 16,
            paddingBottom: bottomInset + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <TabletSettingsList
            onOpenPage={routeName => router.push(settingsHref(routeName))}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  paneContent: {
    paddingHorizontal: 16,
  },
  homeContent: {
    paddingHorizontal: 24,
  },
  column: {
    width: '100%',
    maxWidth: SETTINGS_PAGE_MAX_WIDTH,
    alignSelf: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Manrope-Bold',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    textTransform: 'uppercase',
    letterSpacing: latinLetterSpacing(0.8),
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  group: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginStart: ROW_PADDING + ICON_TILE + 12,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: ROW_PADDING,
    paddingVertical: 8,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Manrope-Medium',
    textAlign: 'left',
  },
  description: {
    fontSize: 13,
    fontFamily: 'Manrope-Regular',
    textAlign: 'left',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Manrope-Regular',
    textAlign: 'left',
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
