// @ai-generated
import {getSystemPlaylists} from '../systemPlaylists';

describe('system playlists', () => {
  it('never repeats the title as the subtitle', () => {
    for (const playlist of getSystemPlaylists()) {
      if (playlist.subtitle) {
        expect(playlist.subtitle).not.toBe(playlist.title);
      }
    }
  });

  it('resolves every subtitle to translated text, not a raw key', () => {
    for (const playlist of getSystemPlaylists()) {
      if (playlist.subtitle) {
        expect(playlist.subtitle).not.toMatch(/systemPlaylists\./);
      }
    }
  });

  it('shows the duration and juz subtitles', () => {
    const byId = new Map(getSystemPlaylists().map(p => [p.id, p]));
    expect(byId.get('quick-listen')?.subtitle).toBe('5-15 minutes');
    expect(byId.get('juz-amma')?.subtitle).toBe('The 30th Juz');
  });
});
