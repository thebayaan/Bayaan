// @ai-generated
import {
  canShowSidebar,
  selectedSidebarItem,
  sidebarMode,
  sidebarPress,
  sidebarWidth,
  tabStack,
} from '../sidebarNav';

type Route = {name: string; key?: string; state?: Stack};
type Stack = {index: number; routes: Route[]};
type TabRoute = {name: string; key: string; params?: object; state?: Stack};

const stack = (names: string[], top = names.length - 1): Stack => ({
  index: top,
  routes: names.map(name => ({name, key: `${name}-key`})),
});

function tabs(
  focused: string,
  stacks: Partial<Record<string, Stack>> = {},
): {index: number; routes: TabRoute[]} {
  const names = [
    '(a.home)',
    '(b.surahs)',
    '(b.search)',
    '(c.collection)',
    '(d.settings)',
  ];
  return {
    index: names.indexOf(focused),
    routes: names.map(name => ({
      name,
      key: `${name}-tab`,
      state: stacks[name],
    })),
  };
}

/** The navigate action that opens a tab with its stack set. */
const opens = (tab: string, index: number, routes: Route[]) => ({
  type: 'NAVIGATE',
  payload: {name: tab, params: {state: {index, routes}}},
});

describe('sidebar width', () => {
  it('is the rail below 900pt and labelled from 900pt', () => {
    expect(sidebarMode(744, false)).toBe('rail');
    expect(sidebarMode(899, false)).toBe('rail');
    expect(sidebarMode(900, false)).toBe('sidebar');
    expect(sidebarMode(1032, false)).toBe('sidebar');
    expect(canShowSidebar(744)).toBe(false);
    expect(canShowSidebar(1133)).toBe(true);
  });

  it('folds to the rail when collapsed', () => {
    expect(sidebarMode(1376, true)).toBe('rail');
  });

  it('is 88pt as a rail, 240pt labelled and 280pt from 1280pt', () => {
    expect(sidebarWidth(744, 'rail')).toBe(88);
    expect(sidebarWidth(1376, 'rail')).toBe(88);
    expect(sidebarWidth(1032, 'sidebar')).toBe(240);
    expect(sidebarWidth(1194, 'sidebar')).toBe(240);
    expect(sidebarWidth(1376, 'sidebar')).toBe(280);
  });
});

describe('tabStack', () => {
  const route = (params?: object, state?: Stack): TabRoute => ({
    name: '(c.collection)',
    key: 'tab',
    params,
    state,
  });

  it('reads the stack from its state once it has one', () => {
    const state = stack(['collection/loved', 'playlist/[id]']);
    expect(tabStack(route({screen: 'collection/notes'}, state))).toBe(state);
  });

  it('reads a stack that has not changed yet from the params it opened with', () => {
    expect(tabStack(route({screen: 'collection/notes'}))).toEqual({
      routes: [{name: 'collection/notes'}],
    });
    expect(
      tabStack(route({screen: 'adhkar', initial: false})).routes.map(
        r => r.name,
      ),
    ).toEqual(['index', 'adhkar']);
    const state = {routes: [{name: 'collection/loved'}]};
    expect(tabStack(route({state}))).toBe(state);
  });

  it('is on its first screen otherwise', () => {
    expect(tabStack(route())).toEqual({routes: [{name: 'index'}]});
  });
});

describe('selectedSidebarItem', () => {
  it('marks Adhkar while the Home stack shows it', () => {
    const home = stack(['index', 'adhkar']);
    expect(
      selectedSidebarItem(tabs('(a.home)', {'(a.home)': home}), 'sidebar'),
    ).toBe('adhkar');
    const back = stack(['index', 'adhkar'], 0);
    expect(
      selectedSidebarItem(tabs('(a.home)', {'(a.home)': back}), 'sidebar'),
    ).toBe('home');
  });

  it('marks the section a Collection screen was opened from', () => {
    const lib = stack(['collection/playlists', 'playlist/[id]']);
    const state = tabs('(c.collection)', {'(c.collection)': lib});
    expect(selectedSidebarItem(state, 'sidebar')).toBe('playlists');
    expect(selectedSidebarItem(state, 'rail')).toBe('library');
  });

  it('marks nothing on the Collection home in the labelled sidebar', () => {
    expect(selectedSidebarItem(tabs('(c.collection)'), 'sidebar')).toBeNull();
  });

  it('marks the tab items by their tab', () => {
    expect(selectedSidebarItem(tabs('(b.surahs)'), 'sidebar')).toBe('quran');
    expect(selectedSidebarItem(tabs('(b.search)'), 'rail')).toBe('search');
    expect(selectedSidebarItem(tabs('(d.settings)'), 'sidebar')).toBe(
      'settings',
    );
  });
});

describe('sidebarPress', () => {
  it('acts as a tab button for the tab items', () => {
    const press = sidebarPress(tabs('(a.home)'), 'search');
    expect(press.tabPress).toBe('(b.search)-tab');
    expect(press.actions).toEqual([
      expect.objectContaining({
        type: 'NAVIGATE',
        payload: expect.objectContaining({name: '(b.search)'}),
      }),
    ]);
    expect(sidebarPress(tabs('(b.search)'), 'search').actions).toEqual([]);
  });

  it('opens a section as the first Collection screen', () => {
    const lib = stack(['index', 'collection/loved']);
    const press = sidebarPress(
      tabs('(a.home)', {'(c.collection)': lib}),
      'downloads',
    );
    expect(press).toEqual({
      actions: [opens('(c.collection)', 0, [{name: 'collection/downloads'}])],
    });
  });

  it('treats a section already at the bottom of the stack as a tab', () => {
    const lib = stack(['collection/playlists', 'playlist/[id]']);
    // On show, tabPress pops the stack to its first screen.
    expect(
      sidebarPress(
        tabs('(c.collection)', {'(c.collection)': lib}),
        'playlists',
      ),
    ).toEqual({tabPress: '(c.collection)-tab', actions: []});
  });

  it('opens Adhkar above Home', () => {
    const home = stack(['index', 'reciter/[id]']);
    expect(
      sidebarPress(tabs('(a.home)', {'(a.home)': home}), 'adhkar').actions,
    ).toEqual([
      opens('(a.home)', 1, [
        {name: 'index', key: 'index-key'},
        {name: 'adhkar'},
      ]),
    ]);
    expect(sidebarPress(tabs('(b.search)'), 'adhkar').actions).toEqual([
      opens('(a.home)', 1, [{name: 'index'}, {name: 'adhkar'}]),
    ]);
  });

  it('takes Adhkar back to its first screen when it is on show', () => {
    const home = stack(['index', 'adhkar']);
    home.routes[1].state = stack(['index', '[superId]/index']);
    expect(
      sidebarPress(tabs('(a.home)', {'(a.home)': home}), 'adhkar').actions,
    ).toEqual([
      opens('(a.home)', 1, [
        {name: 'index', key: 'index-key'},
        {name: 'adhkar'},
      ]),
    ]);
    // Already there: nothing to do.
    const atTop = stack(['index', 'adhkar']);
    expect(
      sidebarPress(tabs('(a.home)', {'(a.home)': atTop}), 'adhkar'),
    ).toEqual({actions: []});
  });

  it('returns to Adhkar where it was from another tab', () => {
    const home = stack(['index', 'adhkar']);
    expect(
      sidebarPress(tabs('(b.search)', {'(a.home)': home}), 'adhkar').actions,
    ).toEqual([
      expect.objectContaining({
        type: 'NAVIGATE',
        payload: {name: '(a.home)', merge: true},
      }),
    ]);
  });

  it('leaves Adhkar when Home is pressed', () => {
    const home = stack(['index', 'adhkar']);
    expect(
      sidebarPress(tabs('(b.search)', {'(a.home)': home}), 'home'),
    ).toEqual({
      actions: [opens('(a.home)', 0, [{name: 'index', key: 'index-key'}])],
    });
    // On show, tabPress pops to Home.
    expect(sidebarPress(tabs('(a.home)', {'(a.home)': home}), 'home')).toEqual({
      tabPress: '(a.home)-tab',
      actions: [],
    });
  });

  it('puts the Collection home back under a section in the rail', () => {
    const lib = stack(['collection/loved']);
    expect(
      sidebarPress(tabs('(a.home)', {'(c.collection)': lib}), 'library')
        .actions,
    ).toEqual([
      opens('(c.collection)', 1, [
        {name: 'index'},
        {name: 'collection/loved', key: 'collection/loved-key'},
      ]),
    ]);
    expect(
      sidebarPress(tabs('(c.collection)', {'(c.collection)': lib}), 'library')
        .actions,
    ).toEqual([opens('(c.collection)', 0, [{name: 'index'}])]);
  });

  it('treats a Collection stack that starts at its home as a tab', () => {
    const lib = stack(['index', 'collection/loved']);
    expect(
      sidebarPress(tabs('(c.collection)', {'(c.collection)': lib}), 'library'),
    ).toEqual({tabPress: '(c.collection)-tab', actions: []});
  });
});
