import React, {useCallback, useMemo, useState} from 'react';
import {FlatList, Pressable, Text, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {SheetManager} from 'react-native-actions-sheet';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Card, useHifzStyles} from '@/components/hifz/HifzUi';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {currentLanguage} from '@/i18n/language';
import {getIntlLocale} from '@/i18n/languages';
import {DAY_MS} from '@/services/hifz/strength';
import {recitationStreak, todaysAyat} from '@/services/hifz/streak';
import {shownFlags} from '@/services/recitation/flags';
import {recitationLogDatabase} from '@/services/recitation/RecitationLogDatabase';
import type {TakeRecord, TakeWord} from '@/services/recitation/take';
import {useHifzStore} from '@/store/hifzStore';
import type {RecitationSummaryMark} from '@/store/recitationTrackingStore';
import {moderateScale} from '@/utils/scale';

/** Takes shown, and counted for the streak. */
const HISTORY_DAYS = 90;

/** Past takes, newest first, with a quiet streak and today's goal. */
/** A saved take's marked words, as the summary sheet lists them. */
function summaryMarks(words: readonly TakeWord[]): RecitationSummaryMark[] {
  const marks: RecitationSummaryMark[] = [];
  for (const w of words) {
    if ((w.result !== 'mistake' && w.result !== 'corrected') || !w.kind) {
      continue;
    }
    marks.push({
      surah: w.surah,
      ayah: w.ayah,
      word: w.word,
      kind: w.kind,
      status: w.result,
    });
  }
  return marks;
}

export default function HifzHistoryScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation(['reader', 'sheets']);
  const insets = useSafeAreaInsets();
  const goal = useHifzStore(s => s.dailyGoalAyat);
  const [takes, setTakes] = useState<TakeRecord[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        recitationLogDatabase.takesSince(Date.now() - HISTORY_DAYS * DAY_MS),
        recitationLogDatabase.dismissedKeys(),
      ])
        .then(([records, keys]) => {
          if (cancelled) return;
          setTakes(records);
          setDismissed(keys);
        })
        .catch(error => console.warn('[hifz] could not read the log', error));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const now = Date.now();
  const tz = new Date().getTimezoneOffset();
  const streak = recitationStreak(takes, now, tz);
  const today = todaysAyat(takes, now, tz);
  const newestFirst = useMemo(() => [...takes].reverse(), [takes]);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(getIntlLocale(currentLanguage), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  );

  const rangeOf = (take: TakeRecord): string => {
    const first = take.ayat[0];
    const last = take.ayat[take.ayat.length - 1];
    if (!first || !last) return '';
    const name = (surah: number) => {
      const data = SURAHS[surah - 1];
      return data ? getSurahDisplayName(data) : localizeDigits(surah);
    };
    if (first.surah !== last.surah) {
      return t('sheets:recitationSummary.rangeSurahs', {
        fromSurah: name(first.surah),
        from: localizeDigits(first.ayah),
        toSurah: name(last.surah),
        to: localizeDigits(last.ayah),
      });
    }
    return first.ayah === last.ayah
      ? t('sheets:recitationSummary.rangeOneAyah', {
          surah: name(first.surah),
          ayah: localizeDigits(first.ayah),
        })
      : t('sheets:recitationSummary.rangeOneSurah', {
          surah: name(first.surah),
          from: localizeDigits(first.ayah),
          to: localizeDigits(last.ayah),
        });
  };

  const purposeOf = (take: TakeRecord): string =>
    take.purpose === 'practice'
      ? t('hifz.purpose.practice')
      : take.hidden
        ? t('hifz.purpose.hidden')
        : t('hifz.purpose.follow');

  return (
    <FlatList
      style={{backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: moderateScale(16),
        paddingBottom: insets.bottom + moderateScale(32),
        gap: moderateScale(10),
      }}
      data={newestFirst}
      keyExtractor={take => take.id}
      ListHeaderComponent={
        <Card>
          {streak.days > 0 ? (
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: 'Manrope-SemiBold',
              }}>
              {t('hifz.streak', {count: streak.days})}
            </Text>
          ) : null}
          <Text style={{color: theme.colors.textSecondary}}>
            {t('hifz.todayGoal', {
              done: localizeDigits(today),
              goal: localizeDigits(goal),
            })}
          </Text>
        </Card>
      }
      ListEmptyComponent={
        <Text style={{color: theme.colors.textSecondary}}>
          {t('hifz.historyEmpty')}
        </Text>
      }
      renderItem={({item}) => {
        const flags = shownFlags(item.flags, dismissed);
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void SheetManager.show('recitation-summary', {
                payload: {
                  summary: {
                    takeId: item.id,
                    startedAt: item.startedAt,
                    endedAt: item.endedAt,
                    ayat: item.ayat.map(({surah, ayah}) => ({surah, ayah})),
                    flags,
                    marks: summaryMarks(item.words ?? []),
                  },
                },
              })
            }
            style={{
              padding: moderateScale(12),
              borderRadius: moderateScale(12),
              backgroundColor: Color(theme.colors.text).alpha(0.04).toString(),
              gap: 2,
            }}>
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: 'Manrope-SemiBold',
              }}>
              {rangeOf(item)}
            </Text>
            <View style={{flexDirection: 'row', gap: moderateScale(8)}}>
              <Text style={{color: theme.colors.textSecondary}}>
                {dateFormat.format(item.startedAt)}
              </Text>
              <Text style={{color: theme.colors.textSecondary}}>
                {purposeOf(item)}
              </Text>
            </View>
            {flags.length > 0 ? (
              <Text style={{color: theme.colors.textSecondary}}>
                {t('hifz.toCheck', {count: flags.length})}
              </Text>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
