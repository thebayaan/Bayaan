jest.mock('@/components/share/SkiaVersePreview', () => () => null);
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000000',
        textSecondary: '#555555',
        background: '#ffffff',
      },
    },
  }),
}));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.defineProperty(Object.create(actual), 'Pressable', {
    value: (props: Record<string, unknown>) =>
      require('react').createElement('View', {
        ...props,
        testID: 'scope-pressable',
      }),
  });
});
jest.mock('react-native-actions-sheet', () => ({
  ScrollView: require('react-native').ScrollView,
}));
jest.mock('@/services/verse-annotations/VerseAnnotationService', () => ({
  verseAnnotationService: {runInScope: jest.fn()},
}));
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {NoteContent} from '../NoteContent';
import {HighlightContent} from '../HighlightContent';
import {verseAnnotationService} from '@/services/verse-annotations/VerseAnnotationService';
import {useVerseAnnotationsStore} from '@/store/verseAnnotationsStore';
import {HIGHLIGHT_COLORS} from '@/types/verse-annotations';

beforeEach(() => {
  jest.clearAllMocks();
  useVerseAnnotationsStore.getState().clearActiveView();
});

test.each([true, false])(
  'saves note text only while its original account is current (current=%s)',
  async scopeCurrent => {
    let current = true;
    const addNote = jest.fn();
    const onDone = jest.fn();
    jest
      .mocked(verseAnnotationService.runInScope)
      .mockImplementation(async task =>
        task({addNote, isCurrent: () => current} as never),
      );
    let screen!: renderer.ReactTestRenderer;
    await act(async () => {
      screen = renderer.create(
        <NoteContent
          verseKey="2:255"
          surahNumber={2}
          ayahNumber={255}
          onDone={onDone}
          isScopeCurrent={() => current}
        />,
      );
    });
    const inputs = screen.root.findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props.onChangeText === 'function',
    );
    expect(inputs).toHaveLength(1);
    await act(async () =>
      inputs[0].props.onChangeText('Account A private draft'),
    );
    const buttons = screen.root.findAll(
      node => node.props.testID === 'scope-pressable',
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.disabled).toBe(false);
    const save = buttons[0].props.onPress;
    expect(save).toEqual(expect.any(Function));
    current = scopeCurrent;
    await act(async () => save());
    if (scopeCurrent) {
      expect(addNote).toHaveBeenCalledWith(
        '2:255',
        2,
        255,
        'Account A private draft',
        undefined,
        undefined,
      );
      expect(onDone).toHaveBeenCalledTimes(1);
    } else {
      expect(verseAnnotationService.runInScope).not.toHaveBeenCalled();
      expect(addNote).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
    }
    await act(async () => screen.unmount());
  },
);

test.each([true, false])(
  'applies and removes highlights only in the original account (current=%s)',
  async scopeCurrent => {
    useVerseAnnotationsStore.getState().setHighlight('2:255', 'yellow');
    let current = true;
    const upsertHighlight = jest.fn();
    const removeHighlight = jest.fn();
    jest
      .mocked(verseAnnotationService.runInScope)
      .mockImplementation(async task =>
        task({
          upsertHighlight,
          removeHighlight,
          isCurrent: () => current,
        } as never),
      );
    let screen!: renderer.ReactTestRenderer;
    await act(async () => {
      screen = renderer.create(
        <HighlightContent
          verseKey="2:255"
          surahNumber={2}
          ayahNumber={255}
          onDone={jest.fn()}
          isScopeCurrent={() => current}
        />,
      );
    });
    const buttons = screen.root
      .findAll(node => node.props.testID === 'scope-pressable')
      .map(button => button.props.onPress);
    expect(buttons).toHaveLength(Object.keys(HIGHLIGHT_COLORS).length + 1);
    expect(buttons.every(press => typeof press === 'function')).toBe(true);
    current = scopeCurrent;
    for (const press of buttons) await act(async () => press());
    if (scopeCurrent) {
      expect(upsertHighlight).toHaveBeenCalledTimes(
        Object.keys(HIGHLIGHT_COLORS).length,
      );
      expect(removeHighlight).toHaveBeenCalledWith('2:255');
    } else {
      expect(verseAnnotationService.runInScope).not.toHaveBeenCalled();
      expect(upsertHighlight).not.toHaveBeenCalled();
      expect(removeHighlight).not.toHaveBeenCalled();
    }
    await act(async () => screen.unmount());
  },
);
