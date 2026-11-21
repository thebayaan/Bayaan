// @ai-generated
// RFC-025 — the card shows only when the source reports a newer build; the
// Update button opens the store, and the close hides the card for 7 days.
import React from 'react';
import TestRenderer, {act, ReactTestRenderer} from 'react-test-renderer';

const mockCheckForUpdate = jest.fn();
const mockIsSnoozed = jest.fn();
const mockSnooze = jest.fn(() => Promise.resolve());
const mockOpenStore = jest.fn(() => Promise.resolve());

jest.mock('@/services/updateCheck', () => ({
  checkForUpdate: () => mockCheckForUpdate(),
  isUpdateCardSnoozed: () => mockIsSnoozed(),
  snoozeUpdateCard: () => mockSnooze(),
  openStoreForUpdate: () => mockOpenStore(),
}));

jest.mock('@/config/branding', () => {
  const branding: Record<string, unknown> = {appName: 'TestApp'};
  return {__esModule: true, default: branding};
});

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      colors: {text: '#06151c', textSecondary: '#052c39', background: '#fff'},
      fonts: {regular: 'R', bold: 'B', medium: 'M'},
    },
  }),
}));

jest.mock('@expo/vector-icons', () => ({Feather: () => null}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.appName ? `${key}(${params.appName})` : key,
  }),
}));

import branding from '@/config/branding';
import {UpdateAvailableCard} from '../UpdateAvailableCard';

const mutableBranding = branding as unknown as Record<string, unknown>;

async function mount(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(<UpdateAvailableCard />);
  });
  return renderer as ReactTestRenderer;
}

function byTestId(renderer: ReactTestRenderer, id: string) {
  return renderer.root.findAll(node => node.props.testID === id);
}

function pressable(renderer: ReactTestRenderer, id: string) {
  const node = byTestId(renderer, id).find(
    n => typeof n.props.onPress === 'function',
  );
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
}

beforeEach(() => {
  mockCheckForUpdate.mockReset();
  mockIsSnoozed.mockReset().mockResolvedValue(false);
  mockSnooze.mockClear();
  mockOpenStore.mockClear();
  mutableBranding.updateSource = jest.fn();
});

describe('UpdateAvailableCard', () => {
  it('renders nothing without a source, and does not check', async () => {
    delete mutableBranding.updateSource;
    const renderer = await mount();
    expect(renderer.toJSON()).toBeNull();
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it('renders nothing when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValue({
      updateAvailable: false,
      storeUrl: null,
    });
    const renderer = await mount();
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders nothing while the card is snoozed', async () => {
    mockCheckForUpdate.mockResolvedValue({
      updateAvailable: true,
      storeUrl: 'market://details?id=x',
    });
    mockIsSnoozed.mockResolvedValue(true);
    const renderer = await mount();
    expect(renderer.toJSON()).toBeNull();
  });

  it('shows the title, the text with the app name, and labelled controls', async () => {
    mockCheckForUpdate.mockResolvedValue({
      updateAvailable: true,
      storeUrl: 'market://details?id=x',
    });
    const renderer = await mount();
    const card = byTestId(renderer, 'update-available-card')[0];
    expect(card.props.accessible).toBe(false);
    const texts = renderer.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children);
    expect(texts).toEqual(
      expect.arrayContaining([
        'updateCard.title',
        'updateCard.body(TestApp)',
        'updateCard.update',
      ]),
    );
    expect(
      pressable(renderer, 'update-available-card-update').props
        .accessibilityLabel,
    ).toBe('updateCard.updateA11y(TestApp)');
    expect(
      pressable(renderer, 'update-available-card-dismiss').props
        .accessibilityLabel,
    ).toBe('updateCard.dismiss');
  });

  it('opens the store on Update', async () => {
    mockCheckForUpdate.mockResolvedValue({
      updateAvailable: true,
      storeUrl: 'market://details?id=x',
    });
    const renderer = await mount();
    await act(async () => {
      pressable(renderer, 'update-available-card-update').props.onPress();
    });
    expect(mockOpenStore).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).not.toBeNull();
  });

  it('hides the card and snoozes it on close', async () => {
    mockCheckForUpdate.mockResolvedValue({
      updateAvailable: true,
      storeUrl: 'market://details?id=x',
    });
    const renderer = await mount();
    await act(async () => {
      pressable(renderer, 'update-available-card-dismiss').props.onPress();
    });
    expect(mockSnooze).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).toBeNull();
  });
});
