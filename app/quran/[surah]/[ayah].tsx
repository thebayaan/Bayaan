import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// @ai-start
// Canonical /quran/{surah}/{ayah} URL (App Links, shared verse links).
// Hands off to /quran/{surah}?ayah=N, which waits for the mushaf data and
// opens the reader on the ayah's page with it selected.
export default function QuranVerseLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah: string}>();
  return (
    <Redirect href={{pathname: '/quran/[surah]', params: {surah, ayah}}} />
  );
}
// @ai-end
