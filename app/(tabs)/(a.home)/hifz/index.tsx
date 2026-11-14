import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {useFocusEffect, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Card,
  Chip,
  LinkRow,
  PrimaryButton,
  SectionHeader,
  useHifzStyles,
} from '@/components/hifz/HifzUi';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {openForRecitation} from '@/services/hifz/openForRecitation';
import {todayPlan} from '@/services/hifz/plan';
import {loadPageStates, PLAN_DATA} from '@/services/hifz/progressLoader';
import type {PageState} from '@/services/hifz/strength';
import {RECITATION_AVAILABLE} from '@/services/recitation/recitationAvailability';
import {useHifzStore} from '@/store/hifzStore';
import {useMushafSettingsStore} from '@/store/mushafSettingsStore';
import {moderateScale} from '@/utils/scale';

const HIFZ = '/(tabs)/(a.home)/hifz';

/** Today's hifz: sabaq, sabqi and manzil, and the hifz tools. */
export default function HifzScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation(['reader', 'common', 'sheets']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const memorizedSurahs = useHifzStore(s => s.memorizedSurahs);
  const sabaq = useHifzStore(s => s.sabaq);
  const newAyatPerDay = useHifzStore(s => s.newAyatPerDay);
  const manzilPagesPerDay = useHifzStore(s => s.manzilPagesPerDay);
  const dailyGoalAyat = useHifzStore(s => s.dailyGoalAyat);
  const setSabaq = useHifzStore(s => s.setSabaq);
  const toggleSurah = useHifzStore(s => s.toggleSurah);
  const [pages, setPages] = useState<Map<number, PageState> | null>(null);
  // The mic follows Hafs recitation and only shows over the Hafs text.
  const hafs = useMushafSettingsStore(s => s.rewayah === 'hafs');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadPageStates()
        .then(states => {
          if (!cancelled) setPages(states);
        })
        .catch(error => {
          console.warn('[hifz] could not read the recitation log', error);
          if (!cancelled) setPages(new Map());
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const plan = useMemo(
    () =>
      todayPlan(
        {
          memorizedSurahs,
          sabaq,
          newAyatPerDay,
          manzilPagesPerDay,
          dailyGoalAyat,
        },
        pages ?? new Map(),
        Date.now(),
        PLAN_DATA,
      ),
    [
      memorizedSurahs,
      sabaq,
      newAyatPerDay,
      manzilPagesPerDay,
      dailyGoalAyat,
      pages,
    ],
  );

  const configured = memorizedSurahs.length > 0 || sabaq !== null;
  const pageLabel = (page: number) =>
    t('common:labels.pageNumber', {number: localizeDigits(page)});

  function sabaqDone(): void {
    if (!plan.sabaq) return;
    const {surah} = plan.sabaq;
    const end = plan.sabaq.ayahEnd ?? plan.sabaq.ayah;
    if (end < PLAN_DATA.ayahCount(surah)) {
      setSabaq({surah, ayah: end + 1});
      return;
    }
    // The surah is memorised: it joins the revision, and new memorisation
    // waits for the reader to pick the next surah.
    if (!memorizedSurahs.includes(surah)) toggleSurah(surah);
    setSabaq(null);
  }

  const sabaqSurah = plan.sabaq ? SURAHS[plan.sabaq.surah - 1] : undefined;

  return (
    <ScrollView
      style={{backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: moderateScale(16),
        paddingBottom: insets.bottom + moderateScale(32),
        gap: moderateScale(12),
      }}>
      {!hafs ? (
        <Card>
          <Text style={{color: theme.colors.text}}>{t('hifz.hafsOnly')}</Text>
          <PrimaryButton
            label={t('hifz.useHafs')}
            onPress={() => useMushafSettingsStore.getState().setRewayah('hafs')}
          />
        </Card>
      ) : null}
      {!configured ? (
        <Card>
          <Text style={{color: theme.colors.text, fontSize: moderateScale(15)}}>
            {t('hifz.setupPrompt')}
          </Text>
          <PrimaryButton
            label={t('hifz.setupButton')}
            onPress={() => router.push(`${HIFZ}/setup`)}
          />
        </Card>
      ) : (
        <>
          <SectionHeader title={t('hifz.today')} />
          {plan.sabaq && sabaqSurah ? (
            <Card>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: 'Manrope-SemiBold',
                }}>
                {t('hifz.sabaq')}
              </Text>
              <Text style={{color: theme.colors.textSecondary}}>
                {t('sheets:recitationSummary.rangeOneSurah', {
                  surah: getSurahDisplayName(sabaqSurah),
                  from: localizeDigits(plan.sabaq.ayah),
                  to: localizeDigits(plan.sabaq.ayahEnd ?? plan.sabaq.ayah),
                })}
              </Text>
              <PrimaryButton
                label={t('recitation.recite')}
                onPress={() => {
                  const at = {
                    surah: plan.sabaq!.surah,
                    ayah: plan.sabaq!.ayah,
                  };
                  const page = PLAN_DATA.pageOf(`${at.surah}:${at.ayah}`);
                  if (page) openForRecitation(page, at);
                }}
              />
              <Chip label={t('hifz.sabaqDone')} onPress={sabaqDone} />
            </Card>
          ) : null}
          <PageCard
            title={t('hifz.sabqi')}
            pages={plan.sabqi}
            pageLabel={pageLabel}
            empty={t('hifz.nothingDue')}
          />
          <PageCard
            title={t('hifz.manzil')}
            pages={plan.manzil}
            pageLabel={pageLabel}
            empty={t('hifz.nothingDue')}
          />
        </>
      )}
      <View>
        {RECITATION_AVAILABLE && (
          <LinkRow
            label={t('hifz.quizzes')}
            onPress={() => router.push(`${HIFZ}/quiz`)}
          />
        )}
        <LinkRow
          label={t('hifz.mutashabihat')}
          onPress={() => router.push(`${HIFZ}/mutashabihat`)}
        />
        {RECITATION_AVAILABLE && (
          <LinkRow
            label={t('hifz.history')}
            onPress={() => router.push(`${HIFZ}/history`)}
          />
        )}
        <LinkRow
          label={t('hifz.heatmap')}
          onPress={() => router.push(`${HIFZ}/heatmap`)}
        />
        <LinkRow
          label={t('hifz.settings')}
          onPress={() => router.push(`${HIFZ}/setup`)}
        />
      </View>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: moderateScale(12),
          lineHeight: moderateScale(18),
        }}>
        {t('hifz.honest')}
      </Text>
    </ScrollView>
  );
}

function PageCard({
  title,
  pages,
  pageLabel,
  empty,
}: {
  title: string;
  pages: readonly number[];
  pageLabel: (page: number) => string;
  empty: string;
}): React.JSX.Element {
  const {theme} = useHifzStyles();
  return (
    <Card>
      <Text style={{color: theme.colors.text, fontFamily: 'Manrope-SemiBold'}}>
        {title}
      </Text>
      {pages.length === 0 ? (
        <Text style={{color: theme.colors.textSecondary}}>{empty}</Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: moderateScale(8),
          }}>
          {pages.map(page => (
            <Chip
              key={page}
              label={pageLabel(page)}
              onPress={() => openForRecitation(page)}
            />
          ))}
        </View>
      )}
    </Card>
  );
}
