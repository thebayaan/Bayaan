import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {SectionHeader, useHifzStyles} from '@/components/hifz/HifzUi';
import {localizeDigits} from '@/i18n/format';
import {openForRecitation} from '@/services/hifz/openForRecitation';
import {loadPageStates, PLAN_DATA} from '@/services/hifz/progressLoader';
import type {PageLevel, PageState} from '@/services/hifz/strength';
import {useHifzStore} from '@/store/hifzStore';
import {getJuzForPage} from '@/utils/quranPages';
import {moderateScale} from '@/utils/scale';
import type {Theme} from '@/utils/themeUtils';

const PAGE_COUNT = 604;
const AMBER = '#D9A21B';

type CellKind = PageLevel | 'notMemorised';

const LEVEL_KEYS = {
  strong: 'hifz.levels.strong',
  fair: 'hifz.levels.fair',
  weak: 'hifz.levels.weak',
  unseen: 'hifz.levels.unseen',
  notMemorised: 'hifz.levels.notMemorised',
} as const satisfies Record<CellKind, string>;

function cellColor(kind: CellKind, theme: Theme): string {
  const text = Color(theme.colors.text);
  switch (kind) {
    case 'strong':
      return text.alpha(0.75).toString();
    case 'fair':
      return text.alpha(0.35).toString();
    case 'weak':
      return Color(AMBER).alpha(0.55).toString();
    case 'unseen':
      return text.alpha(0.1).toString();
    default:
      return 'transparent';
  }
}

/** All 604 pages by juz, shaded by how well each memorised page is held. */
export default function HifzHeatmapScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation('reader');
  const insets = useSafeAreaInsets();
  const memorizedSurahs = useHifzStore(s => s.memorizedSurahs);
  const [pages, setPages] = useState<Map<number, PageState>>(new Map());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadPageStates()
        .then(states => {
          if (!cancelled) setPages(states);
        })
        .catch(error => console.warn('[hifz] could not read the log', error));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const memorized = useMemo(() => {
    const set = new Set<number>();
    for (const surah of memorizedSurahs) {
      for (const page of PLAN_DATA.pagesOfSurah(surah)) set.add(page);
    }
    return set;
  }, [memorizedSurahs]);

  const byJuz = useMemo(() => {
    const groups = new Map<number, number[]>();
    for (let page = 1; page <= PAGE_COUNT; page++) {
      const juz = getJuzForPage(page);
      groups.set(juz, [...(groups.get(juz) ?? []), page]);
    }
    return [...groups.entries()];
  }, []);

  const kindOf = (page: number): CellKind => {
    const state = pages.get(page);
    if (state) return state.level;
    return memorized.has(page) ? 'unseen' : 'notMemorised';
  };

  const legend: CellKind[] = [
    'strong',
    'fair',
    'weak',
    'unseen',
    'notMemorised',
  ];
  const cell = moderateScale(13);
  const border = Color(theme.colors.text).alpha(0.12).toString();

  return (
    <ScrollView
      style={{backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: moderateScale(16),
        paddingBottom: insets.bottom + moderateScale(32),
        gap: moderateScale(8),
      }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: moderateScale(10),
        }}>
        {legend.map(kind => (
          <View
            key={kind}
            style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <View
              style={{
                width: cell,
                height: cell,
                borderRadius: 3,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: cellColor(kind, theme),
              }}
            />
            <Text style={{color: theme.colors.textSecondary, fontSize: 12}}>
              {t(LEVEL_KEYS[kind])}
            </Text>
          </View>
        ))}
      </View>
      {byJuz.map(([juz, juzPages]) => (
        <View key={juz} style={{gap: moderateScale(6)}}>
          <SectionHeader title={t('hifz.juz', {number: localizeDigits(juz)})} />
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 4}}>
            {juzPages.map(page => (
              <Pressable
                key={page}
                onPress={() => openForRecitation(page)}
                accessibilityRole="button"
                accessibilityLabel={`${localizeDigits(page)}: ${t(
                  LEVEL_KEYS[kindOf(page)],
                )}`}
                hitSlop={2}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 3,
                  borderWidth: 1,
                  borderColor: border,
                  backgroundColor: cellColor(kindOf(page), theme),
                }}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
