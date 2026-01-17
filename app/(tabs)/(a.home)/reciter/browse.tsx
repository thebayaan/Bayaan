import React from 'react';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {useTheme} from '@/hooks/useTheme';
import BrowseReciters from '@/components/browse/BrowseReciters';
import {SURAHS} from '@/data/surahData';

export default function BrowseScreen() {
  const router = useRouter();
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
