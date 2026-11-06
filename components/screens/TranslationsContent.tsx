import React, {useState, useCallback, useMemo, useLayoutEffect} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from '@/utils/scale';
import {Theme} from '@/utils/themeUtils';
import Color from 'color';
import {Feather} from '@expo/vector-icons';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {layerVisibilityProps} from '@/utils/layerVisibility'; // @ai
import {useNavigation} from 'expo-router';
import TabSelector from '@/components/TabSelector';
// @ai-start
import {useTranslation} from 'react-i18next';
import {currentLanguageConfig} from '@/i18n/language';
import {TranslationsTab} from './translations/TranslationsTab';
import {TafaseerTab} from './translations/TafaseerTab';
// @ai-end

type ActiveTab = 'Translations' | 'Tafaseer';
const TAB_OPTIONS: ActiveTab[] = ['Translations', 'Tafaseer'];

// @ai-start
interface TranslationsContentProps {
  /**
   * Shown in a card (iPad) rather than a page: the tab selector and a close
   * button go in a header row of its own instead of the navigation header.
   */
  onClose?: () => void;
}

export default function TranslationsContent({
  onClose,
}: TranslationsContentProps = {}) {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = USE_GLASS && !onClose ? rawHeaderHeight : 0;

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    currentLanguageConfig.understandsArabic ? 'Tafaseer' : 'Translations',
  );

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    },
    [activeTab],
  );

  const renderTabSelector = useCallback(
    () => (
      <TabSelector
        options={TAB_OPTIONS}
        selectedOption={activeTab}
        onSelect={handleTabChange}
        getLabel={tab =>
          tab === 'Translations'
            ? t('common:terms.translations')
            : t('common:terms.tafaseer')
        }
        width={moderateScale(220)}
      />
    ),
    [activeTab, handleTabChange, t],
  );

  // Place TabSelector in the navigation header — works in any Stack navigator
  useLayoutEffect(() => {
    if (onClose) {
      return;
    }
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerTintColor: theme.colors.text,
      headerBackButtonDisplayMode: 'minimal',
      headerTitle: renderTabSelector,
    });
  }, [navigation, renderTabSelector, theme.colors.text, onClose]);

  return (
    <View style={styles.container}>
      {onClose ? (
        <View style={styles.cardHeader}>
          {renderTabSelector()}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common:actions.close')}
            style={({pressed}) => [
              styles.cardClose,
              pressed && styles.cardClosePressed,
            ]}>
            <Feather
              name="x"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.content, {paddingTop: headerHeight}]}>
        {/* Layered lists — both stay mounted, toggle visibility */}
        {/* The hidden one also leaves the accessibility tree. @ai */}
        <View style={styles.content}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {opacity: activeTab === 'Translations' ? 1 : 0},
            ]}
            {...layerVisibilityProps(activeTab === 'Translations')}>
            <TranslationsTab />
          </View>
          <View
            style={[
              StyleSheet.absoluteFill,
              {opacity: activeTab === 'Tafaseer' ? 1 : 0},
            ]}
            {...layerVisibilityProps(activeTab === 'Tafaseer')}>
            <TafaseerTab />
          </View>
        </View>
      </View>
    </View>
  );
}
// @ai-end

// @ai-start
const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(12),
    },
    cardClose: {
      width: moderateScale(32),
      height: moderateScale(32),
      borderRadius: moderateScale(16),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    cardClosePressed: {
      opacity: 0.6,
    },
  });
// @ai-end
