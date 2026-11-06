import React from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Card,
  Chip,
  PrimaryButton,
  SectionHeader,
  Stepper,
  useHifzStyles,
} from '@/components/hifz/HifzUi';
import {SURAHS} from '@/data/surahData';
import {getSurahDisplayName, localizeDigits} from '@/i18n/format';
import {useHifzStore} from '@/store/hifzStore';
import {moderateScale} from '@/utils/scale';

/** Surahs 78 to 114. */
const JUZ_AMMA = Array.from({length: 37}, (_, i) => 78 + i);

/** What is memorised, where new memorisation continues, daily amounts. */
export default function HifzSetupScreen(): React.JSX.Element {
  const {theme} = useHifzStyles();
  const {t} = useTranslation(['reader', 'common']);
  const insets = useSafeAreaInsets();
  const memorized = useHifzStore(s => s.memorizedSurahs);
  const sabaq = useHifzStore(s => s.sabaq);
  const newAyatPerDay = useHifzStore(s => s.newAyatPerDay);
  const manzilPagesPerDay = useHifzStore(s => s.manzilPagesPerDay);
  const dailyGoalAyat = useHifzStore(s => s.dailyGoalAyat);
  const {setMemorizedSurahs, toggleSurah, setSabaq, setAmounts} =
    useHifzStore.getState();
  const steps = {
    decreaseLabel: t('hifz.setup.decrease'),
    increaseLabel: t('hifz.setup.increase'),
    format: (value: number) => localizeDigits(value),
  };

  return (
    <ScrollView
      style={{backgroundColor: theme.colors.background}}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: moderateScale(16),
        paddingBottom: insets.bottom + moderateScale(32),
        gap: moderateScale(12),
      }}>
      <SectionHeader title={t('hifz.setup.sabaqHeader')} />
      <Card>
        {sabaq ? (
          <>
            <Stepper
              label={t('hifz.setup.surah')}
              value={sabaq.surah}
              min={1}
              max={114}
              onChange={surah => setSabaq({surah, ayah: 1})}
              {...steps}
              format={value => {
                const surah = SURAHS[value - 1];
                return surah ? getSurahDisplayName(surah) : '';
              }}
            />
            <Stepper
              label={t('hifz.setup.ayah')}
              value={sabaq.ayah}
              min={1}
              max={SURAHS[sabaq.surah - 1]?.verses_count ?? 1}
              onChange={ayah => setSabaq({surah: sabaq.surah, ayah})}
              {...steps}
            />
            <Chip
              label={t('hifz.setup.sabaqStop')}
              onPress={() => setSabaq(null)}
            />
          </>
        ) : (
          <>
            <Text style={{color: theme.colors.textSecondary}}>
              {t('hifz.setup.sabaqNone')}
            </Text>
            <PrimaryButton
              label={t('hifz.setup.sabaqStart')}
              onPress={() => {
                const next =
                  SURAHS.find(s => !memorized.includes(s.id))?.id ?? 1;
                setSabaq({surah: next, ayah: 1});
              }}
            />
          </>
        )}
      </Card>

      <SectionHeader title={t('hifz.setup.amountsHeader')} />
      <Card>
        <Stepper
          label={t('hifz.setup.newAyat')}
          value={newAyatPerDay}
          min={1}
          max={50}
          onChange={value => setAmounts({newAyatPerDay: value})}
          {...steps}
        />
        <Stepper
          label={t('hifz.setup.manzilPages')}
          value={manzilPagesPerDay}
          min={1}
          max={40}
          onChange={value => setAmounts({manzilPagesPerDay: value})}
          {...steps}
        />
        <Stepper
          label={t('hifz.setup.goalAyat')}
          value={dailyGoalAyat}
          min={5}
          max={500}
          step={5}
          onChange={value => setAmounts({dailyGoalAyat: value})}
          {...steps}
        />
      </Card>

      <SectionHeader title={t('hifz.setup.memorisedHeader')} />
      <View style={{flexDirection: 'row', gap: moderateScale(8)}}>
        <Chip
          label={t('hifz.setup.juzAmma')}
          onPress={() => setMemorizedSurahs([...memorized, ...JUZ_AMMA])}
        />
        <Chip
          label={t('common:actions.clear')}
          onPress={() => setMemorizedSurahs([])}
        />
      </View>
      <Card>
        {SURAHS.map(surah => {
          const on = memorized.includes(surah.id);
          return (
            <Pressable
              key={surah.id}
              onPress={() => toggleSurah(surah.id)}
              accessibilityRole="checkbox"
              accessibilityState={{checked: on}}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: moderateScale(8),
              }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: moderateScale(15),
                }}>
                {localizeDigits(surah.id)}. {getSurahDisplayName(surah)}
              </Text>
              <Feather
                name={on ? 'check-circle' : 'circle'}
                size={moderateScale(20)}
                color={on ? theme.colors.text : theme.colors.textSecondary}
              />
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}
