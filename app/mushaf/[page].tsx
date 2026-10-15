// app/mushaf/[page].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// Canonical /mushaf/{page} URL (widgets, App Links). Hands off to the reader.
export default function MushafPageLink(): React.ReactElement {
  const {page} = useLocalSearchParams<{page: string}>();
  return <Redirect href={{pathname: '/mushaf', params: {page}}} />;
}
