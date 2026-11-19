// app/quran/[surah].tsx
import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {ReaderLinkRedirect} from '@/components/mushaf/ReaderLinkRedirect'; // @ai

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the
// reader (the open one, if there is one), which waits for the mushaf data and
// opens the ayah's page. @ai
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  const params = ayah ? {surah, ayah} : {surah};
  return <ReaderLinkRedirect params={params} />; // @ai
}
