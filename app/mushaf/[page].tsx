import React from 'react';
import {Redirect} from 'expo-router';

// Receiver for https://app.thebayaan.com/mushaf/{page}. The app does not
// currently expose a standalone mushaf route (the mushaf renders inside the
// player sheet), so we fall back to the home tab. This keeps Android App Link
// autoverify green and prevents the URL from opening in the browser.
export default function MushafDeepLinkReceiver(): React.ReactElement {
  return <Redirect href="/" />;
}
