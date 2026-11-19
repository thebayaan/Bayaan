// A Quran search hit opened from outside the reader (the Search tab, root
// search in the verse sheet) on the root stack, with the router that
// expo-router ships. With the reader already in the stack, the hit goes to
// that reader with POP_TO (router.dismissTo), as a reader link does
// (readerLinkStack.test.ts): one reader stays, the same route, with the
// hit's params, which the reader then turns to (useReaderLinkPage). With no
// reader, the hit pushes one.
import {
  StackRouter,
  type ParamListBase,
  type StackNavigationState,
} from 'expo-router/build/react-navigation/routers/index';
import {
  quranHitOpenMethod,
  quranHitOpenParams,
} from '@/utils/search/quranHitParams';

const options = {
  routeNames: ['(tabs)', 'mushaf', 'translations'],
  routeParamList: {},
  routeGetIdList: {},
};
const router = StackRouter({});

type Route = {key: string; name: string; params?: object};
type StackAction = Parameters<typeof router.getStateForAction>[1];

function stack(routes: Route[]): StackNavigationState<ParamListBase> {
  return {
    stale: false,
    type: 'stack',
    key: 'root',
    index: routes.length - 1,
    routeNames: options.routeNames,
    routes,
    preloadedRoutes: [],
  } as unknown as StackNavigationState<ParamListBase>;
}

function reduce(
  state: StackNavigationState<ParamListBase>,
  type: 'POP_TO' | 'PUSH',
  params: object,
): StackNavigationState<ParamListBase> {
  const next = router.getStateForAction(
    state,
    {type, payload: {name: 'mushaf', params}, target: 'root'} as StackAction,
    options,
  );
  if (next === null || typeof next !== 'object') {
    throw new Error('action not handled');
  }
  // The router returns {state, ...} or the state itself.
  return ('state' in next
    ? next.state
    : next) as unknown as StackNavigationState<ParamListBase>;
}

/** Opens Hafs 2:255 words 3-4 the way useOpenQuranHit does. */
function openHit(
  state: StackNavigationState<ParamListBase>,
): StackNavigationState<ParamListBase> {
  const method = quranHitOpenMethod(state.routes);
  return reduce(
    state,
    method === 'dismissTo' ? 'POP_TO' : 'PUSH',
    quranHitOpenParams('2:255', [3, 4]),
  );
}

const HIT = {surah: '2', ayah: '255', anchor: '2:255:3', words: '3,4'};
const tabs: Route = {key: 'tabs', name: '(tabs)'};
const reader: Route = {key: 'reader-1', name: 'mushaf', params: {page: '50'}};

it('a push over the open reader stacks a second reader', () => {
  // Why a hit must not push when the reader is open: Back would show the
  // first reader, and the hidden one would take the next page turns.
  const next = reduce(stack([tabs, reader]), 'PUSH', HIT);
  expect(next.routes.map(r => r.name)).toEqual(['(tabs)', 'mushaf', 'mushaf']);
});

it('with the reader on top (the verse sheet over it): one reader, with the hit', () => {
  const next = openHit(stack([tabs, reader]));
  expect(next.routes.map(r => r.key)).toEqual(['tabs', 'reader-1']);
  expect(next.routes[1].params).toEqual(HIT);
  expect(next.index).toBe(1);
});

it('with a screen above the reader (the player over it): back to that reader', () => {
  const next = openHit(
    stack([tabs, reader, {key: 'translations', name: 'translations'}]),
  );
  expect(next.routes.map(r => r.key)).toEqual(['tabs', 'reader-1']);
  expect(next.routes[1].params).toEqual(HIT);
});

it('with no reader (the Search tab): pushes one over the tabs', () => {
  const next = openHit(stack([tabs]));
  expect(next.routes.map(r => r.name)).toEqual(['(tabs)', 'mushaf']);
  expect(next.routes[0].key).toBe('tabs');
  expect(next.routes[1].params).toEqual(HIT);
});

it('picks the method from the root routes', () => {
  expect(quranHitOpenMethod([{name: '(tabs)'}, {name: 'mushaf'}])).toBe(
    'dismissTo',
  );
  expect(quranHitOpenMethod([{name: '(tabs)'}])).toBe('push');
  // A link route hands off to the reader itself; it is not the reader.
  expect(quranHitOpenMethod([{name: '(tabs)'}, {name: 'mushaf/[page]'}])).toBe(
    'push',
  );
  // The navigation is not ready yet.
  expect(quranHitOpenMethod(undefined)).toBe('push');
});
