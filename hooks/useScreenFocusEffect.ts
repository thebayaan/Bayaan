// @ai-start
import {useContext, useEffect} from 'react';
import {NavigationContext} from 'expo-router/react-navigation';

type Cleanup = () => void;

/**
 * Runs `effect` while the screen that holds this component is focused, and
 * runs its cleanup on blur, like `useFocusEffect` of expo-router. Outside a
 * screen (a portal, a unit test) it runs like `useEffect`.
 *
 * Use it for an endless animation. A tab stays mounted behind the other
 * tabs, and a stack screen stays mounted under the next one: an animation
 * there keeps the UI thread busy on every frame, also when nothing on the
 * screen moves. The blur event runs the cleanup also when the screen is
 * frozen (`freezeOnBlur`), where an effect on a focus state does not run.
 *
 * Pass a stable `effect` (wrap it in `useCallback`).
 */
export function useScreenFocusEffect(effect: () => void | Cleanup): void {
  const navigation = useContext(NavigationContext);

  useEffect(() => {
    if (!navigation) return effect() ?? undefined;
    let cleanup: Cleanup | undefined;
    let running = false;
    const start = () => {
      if (running) return;
      running = true;
      cleanup = effect() ?? undefined;
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cleanup?.();
      cleanup = undefined;
    };
    if (navigation.isFocused()) start();
    const offFocus = navigation.addListener('focus', start);
    const offBlur = navigation.addListener('blur', stop);
    return () => {
      offFocus();
      offBlur();
      stop();
    };
  }, [navigation, effect]);
}
// @ai-end
