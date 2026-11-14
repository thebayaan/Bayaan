// @ai-generated
// Work the first screen does not need waits for the splash to go, so it cannot
// hold the splash. whenSplashHidden() settles when the first hide has finished.
import * as SplashScreen from 'expo-splash-screen';

let markSplashHidden: () => void = () => undefined;
const splashHidden = new Promise<void>(resolve => {
  markSplashHidden = resolve;
});

export function whenSplashHidden(): Promise<void> {
  return splashHidden;
}

/** SplashScreen.hideAsync(), which also settles whenSplashHidden(). */
export function hideSplash(): Promise<void> {
  const hidden = SplashScreen.hideAsync().then(() => undefined);
  hidden.then(markSplashHidden, markSplashHidden);
  return hidden;
}
