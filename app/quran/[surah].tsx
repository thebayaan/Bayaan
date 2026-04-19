import React from 'react';
import {Redirect} from 'expo-router';

// Stub: canonical /quran/{surah} URL. No standalone Quran reader in-app yet,
// so deep links fall through to the home tab. Exists for Android App Link
// autoverification on the /quran path prefix.
export default function QuranSurahStub(): React.ReactElement {
  return <Redirect href="/(tabs)/(a.home)" />;
}
