// @ai-generated
// One of Home's reciter collections (Featured, Best for Tajweed…) as a
// grouped list, opened from Home's Collections panel.
import React, {useLayoutEffect, useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useLocalSearchParams, useNavigation, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {useBottomInset} from '@/hooks/useBottomInset';
import {moderateScale} from '@/utils/scale';
import {getReciterDisplayName, localizeDigits} from '@/i18n/format';
import {useTimestampStore} from '@/store/timestampStore';
import {
  PANEL_ART_GAP,
  PANEL_ART_SIZE,
  PANEL_ROW_PADDING,
  PANEL_ROW_VERTICAL,
  PanelRow,
} from '@/components/collection/CollectionPanel';
import {
  HomeSymbol,
  PressScale,
  ReciterAvatar,
  secondaryText,
  useCatalogVersion,
} from '@/components/home/homeKit';
import {findHomeCollection} from '@/components/home/homeCollections';

export default function ReciterCollectionScreen() {
  const {collection} = useLocalSearchParams<{collection: string}>();
  const navigation = useNavigation();
  const router = useRouter();
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const bottomInset = useBottomInset();
  const catalogVersion = useCatalogVersion();
  const registryLoaded = useTimestampStore(s => s.registryLoaded);
  const entry = findHomeCollection(collection);
  const title = entry ? t(entry.titleKey) : '';
  const reciters = useMemo(
    () => entry?.reciters() ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry, catalogVersion, registryLoaded],
  );
  const secondary = secondaryText(theme.colors.text, theme.isDarkMode);

  useLayoutEffect(() => {
    navigation.setOptions({title});
  }, [navigation, title]);

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: moderateScale(12),
        paddingBottom: bottomInset + moderateScale(24),
      }}>
      <Text style={[styles.count, {color: secondary}]}>
        {t('collections.reciterCount', {
          count: reciters.length,
          formatted: localizeDigits(reciters.length),
        })}
      </Text>
      {reciters.map((reciter, i) => {
        const name = getReciterDisplayName(reciter);
        const rewayat = reciter.rewayat.length;
        return (
          <PanelRow
            key={reciter.id}
            first={i === 0}
            last={i === reciters.length - 1}>
            <PressScale
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/(a.home)/reciter/[id]',
                  params: {id: reciter.id},
                })
              }
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={name}
              style={styles.row}>
              <ReciterAvatar reciter={reciter} size={PANEL_ART_SIZE} />
              <View style={styles.text}>
                <Text
                  style={[styles.name, {color: theme.colors.text}]}
                  numberOfLines={1}>
                  {name}
                </Text>
                {rewayat > 1 ? (
                  <Text style={[styles.detail, {color: secondary}]}>
                    {t('collections.rewayatCount', {
                      count: rewayat,
                      formatted: localizeDigits(rewayat),
                    })}
                  </Text>
                ) : null}
              </View>
              <HomeSymbol
                name="chevron"
                size={moderateScale(13)}
                color={secondary}
                weight="bold"
              />
            </PressScale>
          </PanelRow>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  count: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(13),
    paddingHorizontal: moderateScale(36),
    marginBottom: moderateScale(8),
    textAlign: 'left',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PANEL_ROW_PADDING,
    paddingVertical: PANEL_ROW_VERTICAL,
    gap: PANEL_ART_GAP,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: moderateScale(15),
    textAlign: 'left',
  },
  detail: {
    fontFamily: 'Manrope-Regular',
    fontSize: moderateScale(13),
    textAlign: 'left',
  },
});
