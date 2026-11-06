// @ai-generated
import {Platform} from 'react-native';
import i18n from '@/i18n';
import {BayaanKeyboard, type NativeKeyCommand} from '@/modules/bayaan-keyboard';

/**
 * Hardware keyboard shortcuts on iPad (ipad-standards §7.3, reading
 * standards §6).
 *
 * Screens bind keys in layers. The layer added last wins a key, so a screen
 * shown over another (the reader over the tabs, the full player over the
 * reader) overrides it while it shows, and the key goes back when it leaves.
 * Base layers (the app-wide table) always sit under the rest. The keys that
 * apply go to the native main menu, so the iPadOS menu bar and the ⌘-hold
 * list show them, and a press runs the binding that's on top.
 */

type Modifier = NativeKeyCommand['modifiers'][number];

interface KeySpec {
  input: string;
  modifiers: readonly Modifier[];
}

/** Every key the app binds, in the order the menus list them. */
export const KEYS = {
  space: {input: 'space', modifiers: []},
  'shift-space': {input: 'space', modifiers: ['shift']},
  'option-space': {input: 'space', modifiers: ['alternate']},
  left: {input: 'left', modifiers: []},
  right: {input: 'right', modifiers: []},
  'cmd-left': {input: 'left', modifiers: ['command']},
  'cmd-right': {input: 'right', modifiers: ['command']},
  'cmd-l': {input: 'l', modifiers: ['command']},
  'cmd-1': {input: '1', modifiers: ['command']},
  'cmd-2': {input: '2', modifiers: ['command']},
  'cmd-3': {input: '3', modifiers: ['command']},
  'cmd-4': {input: '4', modifiers: ['command']},
  'cmd-5': {input: '5', modifiers: ['command']},
  'cmd-f': {input: 'f', modifiers: ['command']},
  escape: {input: 'escape', modifiers: []},
} as const satisfies Record<string, KeySpec>;

export type KeyId = keyof typeof KEYS;

const KEY_ORDER = Object.keys(KEYS) as KeyId[];

/** The menus, in menu bar order. */
const MENUS = ['playback', 'go', 'reader'] as const;
export type KeyMenuId = (typeof MENUS)[number];

export interface KeyBinding {
  key: KeyId;
  title: string;
  menu: KeyMenuId;
  run: () => void;
  /** Listed greyed out and not run when false. Defaults to true. */
  enabled?: boolean;
  /** Runs again while the key is held. Defaults to false. */
  repeatable?: boolean;
}

export interface KeyLayer {
  update(bindings: readonly KeyBinding[]): void;
  remove(): void;
}

interface LayerEntry {
  base: boolean;
  bindings: readonly KeyBinding[];
}

/** iPad only; phones and Android never send anything to the native side. */
let supported = Platform.OS === 'ios' && Platform.isPad;

export function keyCommandsSupported(): boolean {
  return supported;
}

let layers: LayerEntry[] = [];
let effective = new Map<KeyId, KeyBinding>();
let lastSent = '';
let unsubscribe: (() => void) | null = null;

function menuTitle(menu: KeyMenuId): string {
  switch (menu) {
    case 'playback':
      return i18n.t('common:keyboard.menus.playback');
    case 'go':
      return i18n.t('common:keyboard.menus.go');
    case 'reader':
      return i18n.t('common:keyboard.menus.reader');
  }
}

/** The binding on top for each key: the last layer that binds it. */
function effectiveBindings(
  stack: readonly LayerEntry[],
): Map<KeyId, KeyBinding> {
  const ordered = [...stack.filter(l => l.base), ...stack.filter(l => !l.base)];
  const map = new Map<KeyId, KeyBinding>();
  for (const layer of ordered) {
    for (const binding of layer.bindings) map.set(binding.key, binding);
  }
  return map;
}

function sync(): void {
  effective = effectiveBindings(layers);
  const commands: NativeKeyCommand[] = KEY_ORDER.flatMap(key => {
    const binding = effective.get(key);
    if (!binding) return [];
    return [
      {
        id: key,
        title: binding.title,
        input: KEYS[key].input,
        modifiers: [...KEYS[key].modifiers],
        menu: binding.menu,
        enabled: binding.enabled !== false,
        repeatable: binding.repeatable === true,
      },
    ];
  });
  const menus = MENUS.filter(menu => commands.some(c => c.menu === menu)).map(
    id => ({id, title: menuTitle(id)}),
  );
  const payload = JSON.stringify({menus, commands});
  if (payload === lastSent) return;
  lastSent = payload;
  BayaanKeyboard.setCommands(menus, commands);
}

function handleKey(id: string): void {
  const binding = effective.get(id as KeyId);
  if (!binding || binding.enabled === false) return;
  binding.run();
}

/**
 * Adds a layer of bindings on top of the others (under them for a base
 * layer). `update` swaps its bindings in place, keeping its position.
 */
export function addKeyLayer(
  bindings: readonly KeyBinding[],
  options: {base?: boolean} = {},
): KeyLayer {
  const entry: LayerEntry = {base: options.base === true, bindings};
  if (!supported) return {update: () => undefined, remove: () => undefined};
  layers = [...layers, entry];
  if (!unsubscribe)
    unsubscribe = BayaanKeyboard.addKeyCommandListener(handleKey);
  sync();
  return {
    update(next) {
      entry.bindings = next;
      if (layers.includes(entry)) sync();
    },
    remove() {
      if (!layers.includes(entry)) return;
      layers = layers.filter(l => l !== entry);
      sync();
    },
  };
}

/** Runs the binding on top for a key, as a press would. For tests. */
export function pressKeyForTests(key: KeyId): void {
  handleKey(key);
}

/** Clears every layer, and turns the shortcuts on as on iPad. For tests. */
export function resetKeyCommandsForTests(isPad = true): void {
  supported = isPad;
  layers = [];
  effective = new Map();
  lastSent = '';
  unsubscribe?.();
  unsubscribe = null;
}
