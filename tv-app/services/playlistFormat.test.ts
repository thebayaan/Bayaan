import {
  draftDelete,
  draftKey,
  draftSpace,
  FALLBACK_PLAYLIST_COLOR,
  PLAYLIST_COLORS,
  nextPlaylistColor,
  nextPlaylistName,
  playlistGradient,
  withAlpha,
} from './playlistFormat';
import type {Playlist} from './playlistsStore';

const list = (name: string, color?: string): Playlist => ({
  id: name,
  name,
  ...(color ? {color} : {}),
  items: [],
  createdAt: 0,
  updatedAt: 0,
});

describe('nextPlaylistColor', () => {
  it('starts with the first colour', () => {
    expect(nextPlaylistColor([])).toBe(PLAYLIST_COLORS[0]);
  });

  it('skips colours already used', () => {
    expect(
      nextPlaylistColor([list('a', PLAYLIST_COLORS[0].toLowerCase())]),
    ).toBe(PLAYLIST_COLORS[1]);
  });

  it('cycles once every colour is used', () => {
    const lists = PLAYLIST_COLORS.map((c, i) => list(`${i}`, c));
    expect(PLAYLIST_COLORS).toContain(nextPlaylistColor(lists));
  });
});

describe('nextPlaylistName', () => {
  it('numbers after the playlists there are', () => {
    expect(nextPlaylistName([])).toBe('Playlist 1');
    expect(nextPlaylistName([list('Morning')])).toBe('Playlist 2');
  });

  it('skips a name already taken', () => {
    expect(nextPlaylistName([list('playlist 2'), list('x')])).toBe(
      'Playlist 3',
    );
  });
});

describe('colours', () => {
  it('writes a hex colour as rgba', () => {
    expect(withAlpha('#FF0080', 0.5)).toBe('rgba(255,0,128,0.5)');
  });

  it('falls back for a bad colour', () => {
    expect(withAlpha('nope', 1)).toBe(withAlpha(FALLBACK_PLAYLIST_COLOR, 1));
  });

  it('fades a playlist colour toward the ink', () => {
    expect(playlistGradient('#000000')).toEqual([
      'rgba(0,0,0,0.72)',
      'rgba(0,0,0,0.16)',
    ]);
    expect(playlistGradient()).toEqual(
      playlistGradient(FALLBACK_PLAYLIST_COLOR),
    );
  });
});

describe('name drafts', () => {
  const fresh = {text: 'Playlist 2', fresh: true};

  it('replaces a prefilled name with the first key', () => {
    expect(draftKey(fresh, 'm')).toEqual({text: 'm', fresh: false});
    expect(draftKey({text: 'm', fresh: false}, 'e')).toEqual({
      text: 'me',
      fresh: false,
    });
  });

  it('empties a prefilled name on delete or space', () => {
    expect(draftDelete(fresh)).toEqual({text: '', fresh: false});
    expect(draftSpace(fresh)).toEqual({text: '', fresh: false});
  });

  it('edits a typed name as the search bar does', () => {
    expect(draftDelete({text: 'abc', fresh: false}).text).toBe('ab');
    expect(draftSpace({text: 'a', fresh: false}).text).toBe('a ');
    expect(draftSpace({text: 'a ', fresh: false}).text).toBe('a ');
  });
});
