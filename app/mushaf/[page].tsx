import React from 'react';
import {Redirect} from 'expo-router';

// Stub: canonical /mushaf/{page} URL. No standalone mushaf reader in-app
// yet, so deep links fall through to the home tab. Exists for Android App
// Link autoverification on the /mushaf path prefix.
export default function MushafPageStub(): React.ReactElement {
  return <Redirect href="/(tabs)/(a.home)" />;
}
