// @ai-generated
// The root stack's router contract that the link fix relies on, with the
// router that expo-router ships. A link route (app/mushaf/[page].tsx,
// app/quran/[surah].tsx) hands off with POP_TO (router.dismissTo): one
// reader stays in the stack, with the link's params.
import {
  StackRouter,
  type ParamListBase,
  type StackNavigationState,
} from 'expo-router/build/react-navigation/routers/index';

const options = {
  routeNames: ['(tabs)', 'mushaf', 'mushaf/[page]'],
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

function popToReader(
  state: StackNavigationState<ParamListBase>,
  params: object,
): StackNavigationState<ParamListBase> {
  const action = {type: 'POP_TO', payload: {name: 'mushaf', params}};
  const next = router.getStateForAction(
    state,
    {...action, target: 'root'} as StackAction,
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

it('with a reader open: one reader, with the link params', () => {
  const state = stack([
    {key: 'tabs', name: '(tabs)'},
    {key: 'reader-1', name: 'mushaf', params: {page: '50'}},
    {key: 'link', name: 'mushaf/[page]', params: {page: '60'}},
  ]);
  const next = popToReader(state, {page: '60'});
  expect(next.routes.map(r => r.key)).toEqual(['tabs', 'reader-1']);
  expect(next.routes[1].params).toEqual({page: '60'});
  expect(next.index).toBe(1);
});

it('with no reader open: the link route becomes the reader', () => {
  const state = stack([
    {key: 'tabs', name: '(tabs)'},
    {key: 'link', name: 'mushaf/[page]', params: {page: '60'}},
  ]);
  const next = popToReader(state, {page: '60'});
  expect(next.routes.map(r => r.name)).toEqual(['(tabs)', 'mushaf']);
  expect(next.routes[1].params).toEqual({page: '60'});
});
