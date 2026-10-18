import React, {useEffect, useState} from 'react';
import {AppRegistry} from 'react-native';
import {hydrateStorage} from '../tv-app/services/storage';
import {name as appName} from './app.json';

// The shared app's stores read storage synchronously when their modules load,
// and Vega storage is async (see tv-app/services/storage.kepler.ts). Hydrate
// first, then require the app so those reads see the persisted values.
// hydrateStorage retries; if it still fails, the app loads on an empty
// library for this session and storage stops persisting, so nothing it
// writes replaces the user's saved playlists, loves or favourites.
function Root() {
  const [App, setApp] = useState(null);

  useEffect(() => {
    hydrateStorage()
      .catch((error) => console.warn('[storage] hydrate failed', error))
      .then(() => setApp(() => require('../tv-app/App').default));
  }, []);

  return App ? React.createElement(App) : null;
}

AppRegistry.registerComponent(appName, () => Root);
