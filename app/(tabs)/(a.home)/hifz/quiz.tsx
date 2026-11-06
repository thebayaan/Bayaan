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
import {RECITATION_DOWNLOAD_MB} from '@/constants/recitation';
import {formatNumber, localizeDigits} from '@/i18n/format';
import {
  makeQuestion,
  type QuizKind,
  type QuizQuestion,
} from '@/services/hifz/quiz';
import {QUIZ_DATA} from '@/services/hifz/quizData';
import {recitationModelNeedsDownload} from '@/services/recitation/engineHost';
import {
  startPractice,
  stopPractice,
} from '@/services/recitation/practice/PracticeService';
import type {PracticeOutcome} from '@/services/recitation/practice/types';
import {useHifzStore} from '@/store/hifzStore';
import {usePracticeStore} from '@/store/practiceStore';
import {moderateScale} from '@/utils/scale';

const KINDS: readonly QuizKind[] = ['next', 'continue', 'whichSurah', 'bridge'];

const KIND_KEYS = {
  next: 'hifz.quiz.kinds.next',
  continue: 'hifz.quiz.kinds.continue',
  whichSurah: 'hifz.quiz.kinds.whichSurah',
  bridge: 'hifz.quiz.kinds.bridge',
} as const satisfies Record<QuizKind, string>;

const ASK_KEYS = {
  next: 'hifz.quiz.ask.next',
  continue: 'hifz.quiz.ask.continue',
  whichSurah: 'hifz.quiz.ask.whichSurah',
  bridge: 'hifz.quiz.ask.bridge',
} as const satisfies Record<QuizKind, string>;

const VERDICT_KEYS = {
  clean: 'sheets:practice.verdict.clean',
  flagged: 'sheets:practice.verdict.flagged',
  partial: 'sheets:practice.verdict.partial',
  other: 'sheets:practice.verdict.other',
  nothing: 'sheets:practice.verdict.nothing',
} as const satisfies Record<PracticeOutcome, string>;

/** Quiz questions from the memorised surahs, answered by reciting. */
export default function HifzQuizScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation(['reader', 'sheets', 'common']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const memorized = useHifzStore(s => s.memorizedSurahs);
  const status = usePracticeStore(s => s.status);
  const verdict = usePracticeStore(s => s.verdict);
  const [kind, setKind] = useState<QuizKind>('next');
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState({clean: 0, total: 0});
  const [needsDownload, setNeedsDownload] = useState(false);

  const ask = useCallback(
    (next: QuizKind) => {
      void stopPractice();
      setRevealed(false);
      setQuestion(makeQuestion(next, memorized, Math.random, QUIZ_DATA));
    },
    [memorized],
  );

  useEffect(() => {
    ask(kind);
  }, [ask, kind]);

  useEffect(() => {
    void recitationModelNeedsDownload().then(setNeedsDownload);
    return () => {
      void stopPractice();
    };
  }, []);

  // Count each answered question once, quietly.
  useEffect(() => {
    if (status !== 'done' || !verdict) return;
    setTally(current => ({
      clean: current.clean + (verdict.outcome === 'clean' ? 1 : 0),
      total: current.total + 1,
    }));
  }, [status, verdict]);

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
      <View
        style={{flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(8)}}>
        {KINDS.map(k => (
          <Chip
            key={k}
            label={t(KIND_KEYS[k])}
            selected={k === kind}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      {question ? (
        <Card>
          <Text style={{color: theme.colors.textSecondary}}>
            {t(ASK_KEYS[question.kind])}
          </Text>
          <HafsAyah
            verseKey={question.prompt.verseKey}
            words={question.prompt.words}
          />
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
                {t(VERDICT_KEYS[verdict.outcome])}
              </Text>
              {revealed ? (
                <HafsAyah verseKey={question.answer} />
              ) : (
                <Chip
                  label={t('hifz.quiz.showAnswer')}
                  onPress={() => setRevealed(true)}
                />
              )}
              <PrimaryButton
                label={t('hifz.quiz.nextQuestion')}
                onPress={() => ask(kind)}
              />
            </>
          ) : (
            <>
              {needsDownload ? (
                <Text style={{color: theme.colors.textSecondary}}>
                  {t('hifz.quiz.firstDownload', {
                    size: formatNumber(RECITATION_DOWNLOAD_MB),
                  })}
                </Text>
              ) : null}
              <PrimaryButton
                label={t('hifz.quiz.answer')}
                onPress={() => void startPractice(question.target)}
              />
            </>
          )}
        </Card>
      ) : null}
      {tally.total > 0 ? (
        <Text style={{color: theme.colors.textSecondary, textAlign: 'center'}}>
          {t('hifz.quiz.tally', {
            clean: localizeDigits(tally.clean),
            total: localizeDigits(tally.total),
          })}
        </Text>
      ) : null}
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
