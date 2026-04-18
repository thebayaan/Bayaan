import React from 'react';
import {Redirect} from 'expo-router';

// Receiver for https://app.thebayaan.com/quran/{surah}/{ayah}. The app does
// not currently expose a standalone verse route, so we fall back to the home
// tab. This keeps Android App Link autoverify green and prevents the URL from
// opening in the browser.
export default function QuranVerseDeepLinkReceiver(): React.ReactElement {
  return <Redirect href="/" />;
}
