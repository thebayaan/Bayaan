// @ai-generated
import {useContext} from 'react';
import {NavigationRouteContext} from 'expo-router/build/react-navigation/core/NavigationProvider';
import {NavigatorTypeContext} from 'expo-router/build/react-navigation/core/NavigatorTypeContext';
import {NavigatorStateContext} from 'expo-router/build/react-navigation/core/useNavigationState';

/**
 * True when the screen is the first screen of its stack, so there is nothing
 * in that stack to go back to.
 *
 * The iPad sidebar opens a Collection section as the first screen of the
 * Collection stack (see sidebarNav.ts). A back press there is not handled by
 * the stack, so it reaches the tab navigator, which switches to the Home
 * tab. Screens that draw their own back arrow use this to leave the arrow
 * out, as the system header does on its own.
 *
 * It reads the stack's state rather than `canGoBack()`, which also answers
 * yes when only the tab navigator has somewhere to go. Outside a stack it is
 * false, so the arrow stays.
 */
export function useIsStackRoot(): boolean {
  const stack = useContext(NavigatorStateContext);
  const route = useContext(NavigationRouteContext);
  // The navigator's own type: a stack opened by a link has no `type` in its
  // state until its first action.
  const navigatorType = useContext(NavigatorTypeContext);
  if (!stack || !route || navigatorType !== 'stack') return false;
  return stack.routes[0]?.key === route.key;
}
