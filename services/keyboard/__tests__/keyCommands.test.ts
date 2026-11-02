// @ai-generated
import {
  addKeyLayer,
  pressKeyForTests,
  resetKeyCommandsForTests,
  type KeyBinding,
} from '../keyCommands';
import {BayaanKeyboard} from '@/modules/bayaan-keyboard';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {t: (key: string) => key.split('.').pop()},
}));

const mockRemove = jest.fn();
jest.mock('@/modules/bayaan-keyboard', () => ({
  BayaanKeyboard: {
    isAvailable: true,
    setCommands: jest.fn(),
    addKeyCommandListener: jest.fn(() => mockRemove),
  },
}));

const setCommands = BayaanKeyboard.setCommands as jest.Mock;
const addListener = BayaanKeyboard.addKeyCommandListener as jest.Mock;

function binding(
  key: KeyBinding['key'],
  title: string,
  extra: Partial<KeyBinding> = {},
): KeyBinding {
  return {key, title, menu: 'playback', run: jest.fn(), ...extra};
}

/** What the native side was last told, as [id, title, enabled] rows. */
function sent() {
  const [menus, commands] = setCommands.mock.calls.at(-1) ?? [[], []];
  return {
    menus: menus.map((m: {id: string}) => m.id),
    commands: commands.map(
      (c: {id: string; title: string; enabled: boolean}) => [
        c.id,
        c.title,
        c.enabled,
      ],
    ),
  };
}

beforeEach(() => {
  resetKeyCommandsForTests();
  jest.clearAllMocks();
});

describe('key layers', () => {
  it('sends each key with its input, modifiers and menu', () => {
    addKeyLayer([
      binding('cmd-right', 'Next', {repeatable: false}),
      binding('left', 'Back', {repeatable: true}),
    ]);
    const [menus, commands] = setCommands.mock.calls[0];
    expect(menus).toEqual([{id: 'playback', title: 'playback'}]);
    // Listed in the fixed key order, not the order they were bound in.
    expect(commands).toEqual([
      {
        id: 'left',
        title: 'Back',
        input: 'left',
        modifiers: [],
        menu: 'playback',
        enabled: true,
        repeatable: true,
      },
      {
        id: 'cmd-right',
        title: 'Next',
        input: 'right',
        modifiers: ['command'],
        menu: 'playback',
        enabled: true,
        repeatable: false,
      },
    ]);
  });

  it('lets the layer added last win a key, and gives it back on remove', () => {
    const app = binding('space', 'Play/Pause');
    const reader = binding('space', 'Next Page', {menu: 'reader'});
    addKeyLayer([app]);
    const top = addKeyLayer([reader]);
    expect(sent()).toEqual({
      menus: ['reader'],
      commands: [['space', 'Next Page', true]],
    });
    pressKeyForTests('space');
    expect(reader.run).toHaveBeenCalledTimes(1);
    expect(app.run).not.toHaveBeenCalled();

    top.remove();
    expect(sent().commands).toEqual([['space', 'Play/Pause', true]]);
    pressKeyForTests('space');
    expect(app.run).toHaveBeenCalledTimes(1);
  });

  it('keeps a base layer under layers added before it', () => {
    const screen = binding('escape', 'Close search', {menu: 'reader'});
    const base = binding('escape', 'Close', {menu: 'go'});
    addKeyLayer([screen]);
    addKeyLayer([base], {base: true});
    pressKeyForTests('escape');
    expect(screen.run).toHaveBeenCalled();
    expect(base.run).not.toHaveBeenCalled();
  });

  it('updates a layer in place, keeping its position', () => {
    const lower = addKeyLayer([binding('space', 'Lower')]);
    addKeyLayer([binding('space', 'Upper')]);
    lower.update([binding('space', 'Lower again')]);
    expect(sent().commands).toEqual([['space', 'Upper', true]]);
  });

  it('lists a disabled key greyed out and does not run it', () => {
    const next = binding('cmd-right', 'Next', {enabled: false});
    addKeyLayer([next]);
    expect(sent().commands).toEqual([['cmd-right', 'Next', false]]);
    pressKeyForTests('cmd-right');
    expect(next.run).not.toHaveBeenCalled();
  });

  it('lists only the menus that have keys, in menu bar order', () => {
    addKeyLayer([
      binding('cmd-f', 'Search', {menu: 'reader'}),
      binding('cmd-1', 'Home', {menu: 'go'}),
      binding('space', 'Play/Pause'),
    ]);
    expect(sent().menus).toEqual(['playback', 'go', 'reader']);
    setCommands.mockClear();
    addKeyLayer([]);
    // Nothing changed, so nothing is sent again.
    expect(setCommands).not.toHaveBeenCalled();
  });

  it('listens for presses once, from the first layer', () => {
    addKeyLayer([binding('space', 'A')]);
    addKeyLayer([binding('left', 'B')]);
    expect(addListener).toHaveBeenCalledTimes(1);
    const handler = addListener.mock.calls[0][0] as (id: string) => void;
    handler('not-a-key');
    resetKeyCommandsForTests();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('sends nothing on a phone', () => {
    resetKeyCommandsForTests(false);
    const layer = addKeyLayer([binding('space', 'Play/Pause')]);
    layer.update([binding('space', 'Play')]);
    layer.remove();
    expect(setCommands).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalled();
  });
});
