import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, ScrollView, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HafsAyah} from '@/components/hifz/HafsAyah';
import {
  Card,
  Chip,
  PrimaryButton,
  useHifzStyles,
} from '@/components/hifz/HifzUi';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {qulDataService} from '@/services/mushaf/QulDataService';
import {drillKey, findDrill, type Drill} from '@/services/hifz/mutashabihat';
import {
  startPractice,
  stopPractice,
} from '@/services/recitation/practice/PracticeService';
import type {PracticeVerdict} from '@/services/recitation/practice/types';
import {useHifzStore} from '@/store/hifzStore';
import {usePracticeStore} from '@/store/practiceStore';
import {moderateScale} from '@/utils/scale';

function keysOfSurah(surah: number): string[] {
  const count = SURAHS[surah - 1]?.verses_count ?? 0;
  return Array.from({length: count}, (_, i) => `${surah}:${i + 1}`);
}

const VERDICT_KEYS = {
  clean: 'sheets:practice.verdict.clean',
  flagged: 'sheets:practice.verdict.flagged',
  partial: 'sheets:practice.verdict.partial',
  other: 'sheets:practice.verdict.other',
  nothing: 'sheets:practice.verdict.nothing',
} as const satisfies Record<PracticeVerdict['outcome'], string>;

/** Went into the look-alike: a similar-ayah flag, or another ayah heard. */
function wentAcross(verdict: PracticeVerdict): boolean {
  return (
    verdict.outcome === 'other' ||
    verdict.flags.some(f => f.kind === 'similarAyah')
  );
}

/** Drills on ayat that have a close look-alike elsewhere. */
export default function MutashabihatScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation(['reader', 'sheets', 'common']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const memorized = useHifzStore(s => s.memorizedSurahs);
  const recordPair = useHifzStore(s => s.recordPair);
  const status = usePracticeStore(s => s.status);
  const verdict = usePracticeStore(s => s.verdict);
  const [drill, setDrill] = useState<Drill | null | undefined>(undefined);
  const refLabel = (verseKey: string): string => {
    const [s, a] = verseKey.split(':').map(Number);
    const data = SURAHS[s - 1];
    return t('sheets:recitationSummary.flagRef', {
      surah: data ? getSurahDisplayName(data) : localizeDigits(s),
      ayah: localizeDigits(a),
    });
  };
  const [comparing, setComparing] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const nextDrill = useCallback(async () => {
    await stopPractice();
    setComparing(false);
    setRecorded(false);
    setDrill(undefined);
    const found = await findDrill(
      memorized,
      useHifzStore.getState().pairResults,
      Math.random,
      key => qulDataService.getSimilarAyahs(key),
      keysOfSurah,
    ).catch(error => {
      console.warn('[hifz] could not find a look-alike drill', error);
      return null;
    });
    setDrill(found);
  }, [memorized]);

  useEffect(() => {
    void qulDataService.initialize().then(nextDrill);
    return () => {
      void stopPractice();
    };
  }, [nextDrill]);

  // Remember how each drill went, once.
  useEffect(() => {
    if (status !== 'done' || !verdict || !drill || recorded) return;
    if (verdict.outcome === 'nothing') return;
    recordPair(
      drillKey(drill.ayah, drill.other),
      verdict.outcome === 'clean',
      Date.now(),
    );
    setRecorded(true);
  }, [status, verdict, drill, recorded, recordPair]);

  if (memorized.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: moderateScale(16),
          gap: moderateScale(12),
        }}>
        <Text style={{color: theme.colors.text}}>
          {t('hifz.quiz.needsSetup')}
        </Text>
        <PrimaryButton
          label={t('hifz.setupButton')}
          onPress={() => router.push('/(tabs)/(a.home)/hifz/setup')}
        />
      </View>
    );
  }

  const [surah, ayah] = (drill?.ayah ?? '0:0').split(':').map(Number);
  const listening =
    status === 'loading' ||
    status === 'downloading' ||
    status === 'listening' ||
    status === 'paused';

  return (
    <ScrollView
      style={{backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: moderateScale(16),
        paddingBottom: insets.bottom + moderateScale(32),
        gap: moderateScale(12),
      }}>
      {drill === undefined ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : drill === null ? (
        <Text style={{color: theme.colors.textSecondary}}>
          {t('hifz.trainer.none')}
        </Text>
      ) : (
        <Card>
          <Text style={{color: theme.colors.textSecondary}}>
            {t('hifz.trainer.intro')}
          </Text>
          <Text
            style={{color: theme.colors.text, fontFamily: 'Manrope-SemiBold'}}>
            {refLabel(drill.ayah)}
          </Text>
          {ayah > 1 ? (
            <>
              <Text style={{color: theme.colors.textSecondary}}>
                {t('hifz.trainer.comesAfter')}
              </Text>
              <HafsAyah verseKey={`${surah}:${ayah - 1}`} />
            </>
          ) : (
            <Text style={{color: theme.colors.textSecondary}}>
              {t('hifz.trainer.opensSurah')}
            </Text>
          )}
          {listening ? (
            <View style={{alignItems: 'center', gap: moderateScale(8)}}>
              <ActivityIndicator color={theme.colors.text} />
              <Text style={{color: theme.colors.text}}>
                {t('sheets:whichAyah.listening')}
              </Text>
            </View>
          ) : status === 'done' && verdict ? (
            <>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: 'Manrope-SemiBold',
                  textAlign: 'center',
                }}>
                {verdict.outcome === 'clean'
                  ? t('hifz.trainer.stayed')
                  : wentAcross(verdict)
                    ? t('hifz.trainer.wentAcross')
                    : t(VERDICT_KEYS[verdict.outcome])}
              </Text>
              {comparing ? (
                <>
                  <Text style={{color: theme.colors.textSecondary}}>
                    {refLabel(drill.ayah)}
                  </Text>
                  <HafsAyah verseKey={drill.ayah} />
                  <Text style={{color: theme.colors.textSecondary}}>
                    {refLabel(drill.other)}
                  </Text>
                  <HafsAyah verseKey={drill.other} />
                </>
              ) : (
                <Chip
                  label={t('hifz.trainer.compare')}
                  onPress={() => setComparing(true)}
                />
              )}
              <PrimaryButton
                label={t('hifz.trainer.next')}
                onPress={() => void nextDrill()}
              />
            </>
          ) : (
            <PrimaryButton
              label={t('hifz.quiz.answer')}
              onPress={() =>
                void startPractice({
                  expected: {surah, ayah, ayahEnd: ayah},
                  mode: 'correction',
                })
              }
            />
          )}
        </Card>
      )}
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: moderateScale(12),
          lineHeight: moderateScale(18),
        }}>
        {t('sheets:recitationSummary.footnote')}
      </Text>
    </ScrollView>
  );
}
