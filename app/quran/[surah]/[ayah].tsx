import React from 'react';
import {Redirect} from 'expo-router';

// Stub: canonical /quran/{surah}/{ayah} URL. No standalone verse reader
// in-app yet, so deep links fall through to the home tab. Exists for
// Android App Link autoverification on the /quran path prefix.
export default function QuranVerseStub(): React.ReactElement {
  return <Redirect href="/(tabs)/(a.home)" />;
}
