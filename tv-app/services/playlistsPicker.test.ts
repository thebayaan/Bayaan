import {
  pickerDetail,
  removeFromPlaylist,
  roomForPlaylist,
  togglePlaylistItem,
} from './playlistsPicker';
import {
  MAX_PLAYLISTS,
  MAX_PLAYLIST_ITEMS,
  createPlaylist,
  getPlaylist,
} from './playlistsStore';
import {storage} from './storage';
import {useToastStore} from '../store/toastStore';

const item = (surahNumber: number) => ({surahNumber, reciterId: 'r1'});
const toast = () => useToastStore.getState().toast;

// hide() also stops the toast's timer, so no handle outlives a test.
afterEach(() => useToastStore.getState().hide());

beforeEach(() => {
  storage.clearAll();
  useToastStore.getState().hide();
});

describe('togglePlaylistItem', () => {
  it('adds and removes with a toast each way', () => {
    const id = createPlaylist('Fajr');
    const playlist = {id, name: 'Fajr'};
    expect(togglePlaylistItem(playlist, item(1), false)).toBe(true);
    expect(toast()).toMatchObject({message: 'Added to Fajr', kind: 'info'});
    expect(getPlaylist(id)?.items).toHaveLength(1);
    expect(togglePlaylistItem(playlist, item(1), true)).toBe(false);
    expect(toast()?.message).toBe('Removed from Fajr');
    expect(getPlaylist(id)?.items).toHaveLength(0);
  });

  it('says when the playlist is full', () => {
    const items = Array.from({length: MAX_PLAYLIST_ITEMS}, (_, i) => ({
      surahNumber: (i % 114) + 1,
      reciterId: `r${Math.floor(i / 114)}`,
    }));
    const id = createPlaylist('Full', items);
    expect(togglePlaylistItem({id, name: 'Full'}, item(1), false)).toBe(false);
    expect(toast()).toMatchObject({message: 'Full is full', kind: 'error'});
  });
});

describe('removeFromPlaylist', () => {
  it('removes the row and says so', () => {
    const id = createPlaylist('Isha', [item(1), item(2)]);
    removeFromPlaylist({id, name: 'Isha'}, 0);
    expect(getPlaylist(id)?.items).toEqual([item(2)]);
    expect(toast()?.message).toBe('Removed from Isha');
  });
});

describe('pickerDetail', () => {
  it('reads like the Library', () => {
    expect(pickerDetail({items: []})).toBe('Empty');
    expect(pickerDetail({items: [1]})).toBe('1 surah');
    expect(pickerDetail({items: [1, 2]})).toBe('2 surahs');
  });
});

describe('roomForPlaylist', () => {
  it('lets a playlist be made under the cap', () => {
    expect(roomForPlaylist()).toBe(true);
    expect(toast()).toBeNull();
  });

  it('refuses at the cap before the editor opens', () => {
    expect(roomForPlaylist(MAX_PLAYLISTS)).toBe(false);
    expect(toast()?.kind).toBe('error');
  });
});
