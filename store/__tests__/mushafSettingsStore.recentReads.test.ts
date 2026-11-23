// @ai-generated
// Recent reads are chains: turning pages moves the active chain (the first
// entry), a jump starts a new one and leaves the place being read behind
// as its own chip.
import {useMushafSettingsStore} from '../mushafSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const chips = (): string[] =>
  useMushafSettingsStore
    .getState()
    .recentPages.map(read => `${read.surahId}@${read.page}`);

const {updateActiveChain, startNewChain, resumeChain} =
  useMushafSettingsStore.getState();

beforeEach(() => {
  useMushafSettingsStore.setState({recentPages: []});
});

describe('recent reads chains', () => {
  it('moves the active chain as pages turn', () => {
    updateActiveChain(2, 29);
    updateActiveChain(2, 30);
    expect(chips()).toEqual(['2@30']);
  });

  it('keeps the place being read when a jump starts a new chain', () => {
    updateActiveChain(2, 30);
    // What opening Ya-Sin from the Surahs tab now does on mount, before
    // the pager reports its first page.
    startNewChain(36, 440);
    updateActiveChain(36, 440);
    updateActiveChain(36, 441);
    expect(chips()).toEqual(['36@441', '2@30']);
  });

  it('starts no chain on the page the active chain is already on', () => {
    updateActiveChain(2, 30);
    // "Continue reading" reopens page 30; a verse jump on the page being
    // read used to add a second "page 30" chip.
    startNewChain(2, 30);
    startNewChain(2, 30);
    expect(chips()).toEqual(['2@30']);
  });

  it('brings an older chain on that page to the front, not a twin', () => {
    updateActiveChain(2, 30);
    startNewChain(36, 440);
    startNewChain(18, 293);
    startNewChain(2, 30);
    expect(chips()).toEqual(['2@30', '18@293', '36@440']);
  });

  it('keeps the ten most recent chains', () => {
    for (let page = 1; page <= 12; page++) startNewChain(2, page + 1);
    expect(chips()).toHaveLength(10);
    expect(chips()[0]).toBe('2@13');
  });

  it('resumes an older chain by moving it to the front', () => {
    updateActiveChain(2, 30);
    startNewChain(36, 440);
    resumeChain(1);
    expect(chips()).toEqual(['2@30', '36@440']);
  });
});
