import {
  adhkarStackAction,
  openPlayingDhikr,
  planOpenPlaying,
  setAdhkarFocus,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import type {AdhkarStackRoute} from '@/services/adhkar/playback/openPlayingDhikr';
import type {AdhkarSession} from '@/services/adhkar/playback/types';

const session: AdhkarSession = {
  listId: 'morning-adhkar',
  listTitle: 'Morning Adhkar',
  items: [
    {dhikrId: 'a', audioFile: 'a.mp3', playable: true, preview: 'a'},
    {dhikrId: 'b', audioFile: 'b.mp3', playable: true, preview: 'b'},
  ],
  index: 1,
  mode: 'all',
  loop: false,
  status: 'playing',
  error: false,
  trackToken: 1,
  positionSec: 0,
  lastActiveAt: 0,
};

it('does nothing without a session', () => {
  expect(planOpenPlaying(null, null)).toEqual({kind: 'none'});
});
it('reveals when the session list reader or list is focused', () => {
  expect(
    planOpenPlaying(session, {kind: 'reader', listId: 'morning-adhkar'}),
  ).toEqual({kind: 'reveal'});
  expect(
    planOpenPlaying(session, {kind: 'list', listId: 'morning-adhkar'}),
  ).toEqual({kind: 'reveal'});
});
it('opens the Adhkar screen, the category list and the reader at the playing index', () => {
  expect(
    planOpenPlaying(session, {kind: 'reader', listId: 'evening-adhkar'}),
  ).toEqual({
    kind: 'push',
    routes: [
      {name: 'index', params: {}},
      {name: '[superId]/index', params: {superId: 'morning-adhkar'}},
      {
        name: '[superId]/[dhikrId]',
        params: {
          superId: 'morning-adhkar',
          dhikrId: 'b',
          globalIndex: '1',
          superCategoryTitle: 'Morning Adhkar',
        },
      },
    ],
  });
});
it('opens the Adhkar screen, the saved list and its reader for a saved session', () => {
  expect(planOpenPlaying({...session, listId: 'saved'}, null)).toEqual({
    kind: 'push',
    routes: [
      {name: 'index', params: {}},
      {name: 'saved/index', params: {}},
      {name: 'saved/[dhikrId]', params: {dhikrId: 'b', globalIndex: '1'}},
    ],
  });
});

describe('openPlayingDhikr', () => {
  const navigation = {dispatch: jest.fn()};
  beforeEach(() => {
    navigation.dispatch.mockClear();
    useAdhkarSessionStore.setState({session, revealToken: 0});
    setAdhkarFocus({kind: 'list', listId: 'morning-adhkar'});
  });
  afterEach(() => {
    setAdhkarFocus(null);
    useAdhkarSessionStore.setState({session: null, revealToken: 0});
  });

  it('reveals in place when the session list is focused', () => {
    expect(openPlayingDhikr(navigation)).toBe(true);
    expect(useAdhkarSessionStore.getState().revealToken).toBe(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  it('the deep link route navigates even while the session list is focused', () => {
    expect(openPlayingDhikr(navigation, null)).toBe(true);
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalledWith(
      adhkarStackAction([
        {name: 'index', params: {}},
        {name: '[superId]/index', params: {superId: 'morning-adhkar'}},
        {
          name: '[superId]/[dhikrId]',
          params: {
            superId: 'morning-adhkar',
            dhikrId: 'b',
            globalIndex: '1',
            superCategoryTitle: 'Morning Adhkar',
          },
        },
      ]),
    );
    expect(useAdhkarSessionStore.getState().revealToken).toBe(0);
  });
});

it('adhkarStackAction pops to the tabs and nests the routes under the home adhkar stack', () => {
  const routes: AdhkarStackRoute[] = [{name: 'saved/index', params: {}}];
  expect(adhkarStackAction(routes)).toEqual({
    type: 'NAVIGATE',
    payload: {
      name: '(tabs)',
      pop: true,
      params: {
        screen: '(a.home)',
        params: {screen: 'adhkar', params: {state: {routes}}},
      },
    },
  });
});
