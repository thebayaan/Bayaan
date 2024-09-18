import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useReciterStore} from '@/store/useReciterStore';
import {RECITERS} from '@/data/reciterData';

export default function PlayerScreen() {
  const {surahId, reciterId} = useLocalSearchParams<{
    surahId: string;
    reciterId: string;
  }>();
  const {theme} = useTheme();
  const defaultReciter = useReciterStore(state => state.defaultReciter);
  const [reciterName, setReciterName] = useState<string>('Default Reciter');

  useEffect(() => {
    if (reciterId === 'default' && defaultReciter) {
      setReciterName(defaultReciter.name);
    } else {
      const selectedReciter = RECITERS.find(r => r.id === reciterId);
      setReciterName(
        selectedReciter ? selectedReciter.name : 'Unknown Reciter',
      );
    }
  }, [reciterId, defaultReciter]);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text style={[styles.text, {color: theme.colors.text}]}>
        Playing Surah {surahId} with Reciter: {reciterName}
      </Text>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '20@s',
  },
  text: {
    fontSize: moderateScale(18),
    textAlign: 'center',
  },
});
