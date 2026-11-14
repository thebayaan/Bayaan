import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

const mockAvailable = {value: true};
const mockRewayah = {value: 'hafs'};

jest.mock('@/services/recitation/recitationAvailability', () => ({
  get RECITATION_AVAILABLE() {
    return mockAvailable.value;
  },
}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {colors: {text: '#111111', textSecondary: '#555555'}},
  }),
}));
jest.mock('@/utils/toastUtils', () => ({showToast: jest.fn()}));
jest.mock('@/store/mushafSettingsStore', () => ({
  useMushafSettingsStore: (select: (s: {rewayah: string}) => unknown) =>
    select({rewayah: mockRewayah.value}),
}));
jest.mock('@/services/mushaf/MushafVerseMapService', () => ({
  mushafVerseMapService: {},
}));
jest.mock('@/services/recitation/RecitationTrackingService', () => ({
  clearRecitationSummary: jest.fn(),
  peekRecitation: jest.fn(),
  recitationModelNeedsDownload: jest.fn(async () => false),
  scheduleUnload: jest.fn(),
  setRecitationHidden: jest.fn(),
  setRecitationHint: jest.fn(),
  startRecitationTracking: jest.fn(),
  stopRecitationTracking: jest.fn(),
}));
jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: jest.fn()},
}));

import {RecitationMicButton} from '../RecitationMicButton';

function micShown(): boolean {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<RecitationMicButton currentPage={1} />);
  });
  return r.toJSON() !== null;
}

describe('RecitationMicButton', () => {
  beforeEach(() => {
    mockAvailable.value = true;
    mockRewayah.value = 'hafs';
  });

  it('shows over Hafs text', () => {
    expect(micShown()).toBe(true);
  });

  it('hides over other riwayat', () => {
    mockRewayah.value = 'warsh';
    expect(micShown()).toBe(false);
  });

  it('hides where recitation is not available', () => {
    mockAvailable.value = false;
    expect(micShown()).toBe(false);
  });
});
