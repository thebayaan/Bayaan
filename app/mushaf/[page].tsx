// app/mushaf/[page].tsx
import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {ReaderLinkRedirect} from '@/components/mushaf/ReaderLinkRedirect'; // @ai

// Canonical /mushaf/{page} URL (widgets, App Links). Hands off to the reader:
// the open one, if there is one (not a second). @ai
export default function MushafPageLink(): React.ReactElement {
  const {page} = useLocalSearchParams<{page: string}>();
  return <ReaderLinkRedirect params={{page}} />; // @ai
}
