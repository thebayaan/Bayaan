// app/quran/[surah].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the
// reader, which waits for the mushaf data and opens the ayah's page. @ai
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  const params = ayah ? {surah, ayah} : {surah};
  return <Redirect href={{pathname: '/mushaf', params}} />;
}
