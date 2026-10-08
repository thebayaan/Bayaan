jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        text: '#111111',
        textSecondary: '#555555',
      },
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

jest.mock('@/services/sync/qfSyncLifecycle', () => ({
  qfSyncLifecycle: {resolveGuestDecision: jest.fn(async () => undefined)},
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {GuestDataMergeSheet} from '../GuestDataMergeSheet';
import {useQfSyncStore} from '@/store/qfSyncStore';

function renderedText(screen: renderer.ReactTestRenderer): string[] {
  return screen.root
    .findAll(node => String(node.type) === 'Text')
    .map(node => [node.props.children].flat().join(''));
}

async function renderPrompt(counts: {
  bookmarkCount: number;
  noteCount: number;
  highlightCount: number;
}): Promise<string[]> {
  useQfSyncStore.setState({
    guestMergePrompt: {
      accountId: 'account-a',
      ...counts,
      totalCount:
        counts.bookmarkCount + counts.noteCount + counts.highlightCount,
      submitting: false,
    },
  });
  let screen: renderer.ReactTestRenderer | undefined;
  await act(async () => {
    screen = renderer.create(<GuestDataMergeSheet />);
  });
  if (!screen) throw new Error('GuestDataMergeSheet did not render');
  const text = renderedText(screen);
  await act(async () => {
    screen?.unmount();
  });
  return text;
}

afterEach(() => {
  useQfSyncStore.getState().resetForTesting();
});

describe('GuestDataMergeSheet', () => {
  it('uses singular nouns for a count of one', async () => {
    expect(
      await renderPrompt({bookmarkCount: 1, noteCount: 1, highlightCount: 1}),
    ).toContain('1 bookmark · 1 note · 1 highlight');
  });

  it('uses plural nouns for zero and many', async () => {
    expect(
      await renderPrompt({bookmarkCount: 2, noteCount: 0, highlightCount: 3}),
    ).toContain('2 bookmarks · 0 notes · 3 highlights');
  });
});
