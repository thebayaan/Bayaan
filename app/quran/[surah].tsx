import React from 'react';
import {Redirect} from 'expo-router';

// Receiver for https://app.thebayaan.com/quran/{surah}?v={ayah}. The app does
// not currently expose a standalone quran surah route, so we fall back to the
// home tab. This keeps Android App Link autoverify green and prevents the URL
// from opening in the browser.
export default function QuranSurahDeepLinkReceiver(): React.ReactElement {
  return <Redirect href="/" />;
}
