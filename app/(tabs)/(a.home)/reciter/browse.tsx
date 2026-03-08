import React, {useLayoutEffect} from 'react';
import {useRouter, useLocalSearchParams, useNavigation} from 'expo-router';
import {Platform} from 'react-native';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';

export default function BrowseScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {surahId, teacher, student, rewayatName} = useLocalSearchParams<{
    surahId: string;
    teacher: string;
    student: string;
    rewayatName: string;
  }>();

  const handleBack = () => {
    router.back();
  };

  // Get title based on context
  const title = rewayatName
    ? rewayatName
    : surahId
      ? `Browse Reciters - ${SURAHS[parseInt(surahId, 10) - 1].name}`
      : 'Browse All';

  // Set native header title on iOS
  useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({headerTitle: title});
    }
  }, [navigation, title]);

  return (
    <BrowseReciters
      theme={theme}
      onBack={handleBack}
      surahId={surahId ? parseInt(surahId, 10) : undefined}
      title={title}
      initialTeacher={teacher}
      initialStudent={student}
    />
  );
}
