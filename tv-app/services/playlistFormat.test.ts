import {
  draftDelete,
  draftKey,
  draftSpace,
  FALLBACK_PLAYLIST_COLOR,
  PLAYLIST_COLORS,
  isArabicText,
  nextPlaylistColor,
  nextPlaylistName,
  playlistColorName,
  playlistGradient,
  playlistTint,
  uniquePlaylistName,
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

describe('uniquePlaylistName', () => {
  it('keeps a name nobody has', () => {
    expect(uniquePlaylistName('Fajr', [list('Isha')])).toBe('Fajr');
  });

  it('numbers a name another playlist has', () => {
    expect(uniquePlaylistName('Fajr', [list('fajr')])).toBe('Fajr 2');
    expect(uniquePlaylistName('Fajr', [list('Fajr'), list('Fajr 2')])).toBe(
      'Fajr 3',
    );
  });

  it('lets a renamed playlist keep its own name', () => {
    expect(uniquePlaylistName('Fajr', [list('Fajr')], 'Fajr')).toBe('Fajr');
  });
});

/** HSL lightness and saturation of a #rrggbb colour, 0 to 1. */
function lightSat(hex: string): {l: number; s: number} {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(
    c => c / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  return {l, s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))};
}

describe('colours', () => {
  it('names every colour for the screen reader', () => {
    expect(playlistColorName('#6366f1')).toBe('Indigo');
    expect(new Set(PLAYLIST_COLORS.map(playlistColorName)).size).toBe(12);
    expect(playlistColorName('#123456')).toBe('Colour');
  });

  it('draws the phone colours as muted pigments', () => {
    for (const c of PLAYLIST_COLORS) {
      const tint = playlistTint(c);
      expect(tint).toMatch(/^#[0-9a-f]{6}$/);
      const {l, s} = lightSat(tint);
      // The surah pigments sit at about 0.3-0.45 lightness, 0.35-0.6
      // saturation; the phone colours are 0.45-0.6 and 0.8-0.95.
      expect(l).toBeGreaterThan(0.3);
      expect(l).toBeLessThan(0.48);
      expect(s).toBeLessThan(0.6);
    }
  });

  it('fades a playlist colour into the ink with opaque stops', () => {
    const [from, to] = playlistGradient('#6366F1');
    // react-native-svg drops rgba alpha: both stops must be plain hex.
    expect(from).toBe(playlistTint('#6366F1'));
    expect(to).toMatch(/^#[0-9a-f]{6}$/);
    expect(lightSat(to).l).toBeLessThan(lightSat(from).l);
    expect(playlistGradient()).toEqual(
      playlistGradient(FALLBACK_PLAYLIST_COLOR),
    );
  });

  it('falls back for a bad colour', () => {
    expect(playlistTint('nope')).toBe(playlistTint(FALLBACK_PLAYLIST_COLOR));
  });
});

describe('name drafts', () => {
  const fresh = {text: 'Playlist 2', fresh: true};

  it('replaces a prefilled name with the first key, capitalised', () => {
    expect(draftKey(fresh, 'm')).toEqual({text: 'M', fresh: false});
    expect(draftKey({text: 'M', fresh: false}, 'e')).toEqual({
      text: 'Me',
      fresh: false,
    });
  });

  it('capitalises only the first letter', () => {
    expect(draftKey({text: 'Fajr ', fresh: false}, 'a').text).toBe('Fajr a');
    expect(draftKey({text: '', fresh: false}, 'ب').text).toBe('ب');
  });

  it('edits a prefilled name on delete or space', () => {
    const name = {text: 'Fajr adhkar', fresh: true};
    expect(draftDelete(name)).toEqual({text: 'Fajr adhka', fresh: false});
    expect(draftSpace(name)).toEqual({text: 'Fajr adhkar ', fresh: false});
  });

  it('edits a typed name as the search bar does', () => {
    expect(draftDelete({text: 'abc', fresh: false}).text).toBe('ab');
    expect(draftSpace({text: 'a', fresh: false}).text).toBe('a ');
    expect(draftSpace({text: 'a ', fresh: false}).text).toBe('a ');
  });

  it('spots an Arabic name', () => {
    expect(isArabicText('فجر')).toBe(true);
    expect(isArabicText('Fajr فجر')).toBe(true);
    expect(isArabicText('Fajr')).toBe(false);
  });
});
