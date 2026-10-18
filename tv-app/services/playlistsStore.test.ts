import {
  addPlaylistItem,
  cleanPlaylistName,
  createPlaylist,
  editPlaylist,
  getPlaylist,
  getPlaylists,
  hasPlaylistItem,
  movePlaylistItem,
  playlistHas,
  removePlaylist,
  removePlaylistItem,
  renamePlaylist,
  setPlaylistColor,
  PLAYLISTS_KEY,
} from './playlistsStore';
import {storage} from './storage';

const item = (surahNumber: number, reciterId = 'r1', rewayahId = 'w1') => ({
  surahNumber,
  reciterId,
  rewayahId,
});

beforeEach(() => storage.clearAll());

describe('playlistsStore', () => {
  it('starts empty', () => {
    expect(getPlaylists()).toEqual([]);
  });

  it('creates a playlist with items and returns its id', () => {
    const id = createPlaylist('Night', [item(67), item(18)]);
    const p = getPlaylist(id);
    expect(p?.name).toBe('Night');
    expect(p?.items.map(i => i.surahNumber)).toEqual([67, 18]);
    expect(id.startsWith('playlist_')).toBe(true);
  });

  it('gives each playlist a unique id even within one millisecond', () => {
    const a = createPlaylist('A');
    const b = createPlaylist('B');
    expect(a).not.toBe(b);
    expect(getPlaylists()).toHaveLength(2);
  });

  it('drops duplicate items on create and on add', () => {
    const id = createPlaylist('Dupes', [item(1), item(1)]);
    expect(getPlaylist(id)?.items).toHaveLength(1);
    expect(addPlaylistItem(id, item(1))).toBe(false);
    expect(addPlaylistItem(id, item(1, 'r2'))).toBe(true);
    expect(getPlaylist(id)?.items).toHaveLength(2);
    expect(hasPlaylistItem(id, item(1, 'r2'))).toBe(true);
  });

  it('checks a playlist it is given by surah, reciter and rewayah', () => {
    const p = getPlaylist(createPlaylist('Has', [item(1)]));
    if (!p) throw new Error('missing');
    expect(playlistHas(p, item(1))).toBe(true);
    expect(playlistHas(p, item(1, 'r1', 'other'))).toBe(false);
    expect(playlistHas(p, item(2))).toBe(false);
  });

  it('rejects invalid surah numbers', () => {
    const id = createPlaylist('Bad');
    expect(addPlaylistItem(id, item(0))).toBe(false);
    expect(addPlaylistItem(id, item(115))).toBe(false);
    expect(getPlaylist(id)?.items).toEqual([]);
  });

  it('cleans names and falls back when empty', () => {
    expect(cleanPlaylistName('  Friday   evening ')).toBe('Friday evening');
    expect(cleanPlaylistName('   ')).toBe('My playlist');
    const id = createPlaylist('Old');
    renamePlaylist(id, ' New ');
    expect(getPlaylist(id)?.name).toBe('New');
  });

  it('sets and clears a color', () => {
    const id = createPlaylist('C', [], '#8DC9D6');
    expect(getPlaylist(id)?.color).toBe('#8DC9D6');
    setPlaylistColor(id, undefined);
    expect(getPlaylist(id)?.color).toBeUndefined();
  });

  it('removes and moves items', () => {
    const id = createPlaylist('Order', [item(1), item(2), item(3)]);
    movePlaylistItem(id, 0, 2);
    expect(getPlaylist(id)?.items.map(i => i.surahNumber)).toEqual([2, 3, 1]);
    movePlaylistItem(id, 2, -5);
    expect(getPlaylist(id)?.items.map(i => i.surahNumber)).toEqual([1, 2, 3]);
    removePlaylistItem(id, 1);
    expect(getPlaylist(id)?.items.map(i => i.surahNumber)).toEqual([1, 3]);
    removePlaylistItem(id, item(3));
    expect(getPlaylist(id)?.items.map(i => i.surahNumber)).toEqual([1]);
  });

  it('removes a playlist', () => {
    const id = createPlaylist('Gone');
    removePlaylist(id);
    expect(getPlaylist(id)).toBeNull();
  });

  it('lists the most recently changed first', async () => {
    const a = createPlaylist('A');
    await new Promise(r => setTimeout(r, 5));
    createPlaylist('B');
    await new Promise(r => setTimeout(r, 5));
    addPlaylistItem(a, item(5));
    expect(getPlaylists().map(p => p.name)).toEqual(['A', 'B']);
  });

  it('falls back to the name given when a name is empty', () => {
    expect(cleanPlaylistName(' ', 'Playlist 3')).toBe('Playlist 3');
  });

  it('edits name and colour in one write, and skips an unchanged edit', async () => {
    const a = createPlaylist('A', [], '#6366F1');
    await new Promise(r => setTimeout(r, 5));
    createPlaylist('B');
    expect(getPlaylists().map(p => p.name)).toEqual(['B', 'A']);
    const before = storage.getString(PLAYLISTS_KEY);
    // Unchanged (the colour in another case): nothing written, order kept.
    expect(editPlaylist(a, {name: 'A ', color: '#6366f1'})).toBe(false);
    expect(storage.getString(PLAYLISTS_KEY)).toBe(before);
    expect(getPlaylists().map(p => p.name)).toEqual(['B', 'A']);
    await new Promise(r => setTimeout(r, 5));
    // An empty name keeps the old one.
    expect(editPlaylist(a, {name: '', color: '#EC4899'})).toBe(true);
    expect(getPlaylist(a)).toMatchObject({name: 'A', color: '#EC4899'});
    expect(getPlaylists().map(p => p.name)).toEqual(['A', 'B']);
    expect(editPlaylist(a, {name: 'Fajr', color: '#EC4899'})).toBe(true);
    expect(getPlaylist(a)?.name).toBe('Fajr');
    expect(editPlaylist('nope', {name: 'x'})).toBe(false);
  });

  it('changes to a missing playlist report false', () => {
    expect(renamePlaylist('nope', 'x')).toBe(false);
    expect(addPlaylistItem('nope', item(1))).toBe(false);
  });

  it('ignores corrupt storage', () => {
    storage.set(PLAYLISTS_KEY, '{"not":"a list"}');
    expect(getPlaylists()).toEqual([]);
    storage.set(
      PLAYLISTS_KEY,
      JSON.stringify([
        {
          id: 'p',
          name: 'P',
          items: [item(2), {surahNumber: 'x'}],
          createdAt: 1,
          updatedAt: 1,
        },
        null,
      ]),
    );
    expect(getPlaylists()).toHaveLength(1);
    expect(getPlaylists()[0].items).toHaveLength(1);
  });
});
