import {
  DEFAULT_SURAH_ARTWORK_BASE,
  normalizeSurahArtworkBase,
} from '@/utils/surahArtworkBase';
import {surahArtworkUrl} from '@/services/widgets/surahArtwork';

describe('normalizeSurahArtworkBase', () => {
  it('defaults to the car surah cards', () => {
    expect(DEFAULT_SURAH_ARTWORK_BASE).toBe(
      'https://cdn.thebayaan.com/assets/car/surah/',
    );
    expect(normalizeSurahArtworkBase(undefined)).toBe(
      DEFAULT_SURAH_ARTWORK_BASE,
    );
  });

  it('adds one trailing slash to an https base', () => {
    expect(normalizeSurahArtworkBase(' https://cdn.fork.example/s/// ')).toBe(
      'https://cdn.fork.example/s/',
    );
    expect(normalizeSurahArtworkBase('https://cdn.fork.example/s')).toBe(
      'https://cdn.fork.example/s/',
    );
  });

  it('falls back for anything but a plain https base', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    [
      '',
      'http://a.example/s/',
      'https://a.example/s?x=1',
      'file:///x/',
    ].forEach(raw =>
      expect(normalizeSurahArtworkBase(raw)).toBe(DEFAULT_SURAH_ARTWORK_BASE),
    );
    warn.mockRestore();
  });
});

describe('widget surahArtworkUrl', () => {
  it('uses the branding base (Bayaan default) and accepts another base', () => {
    expect(surahArtworkUrl(18)).toBe(
      'https://cdn.thebayaan.com/assets/car/surah/18.png',
    );
    expect(surahArtworkUrl(67, 'https://cdn.fork.example/s/')).toBe(
      'https://cdn.fork.example/s/67.png',
    );
  });
});

describe('widget artwork follows branding', () => {
  it('reads branding.surahArtworkCdnBase', () => {
    jest.isolateModules(() => {
      jest.doMock('@/config/branding', () => ({
        __esModule: true,
        default: {surahArtworkCdnBase: 'https://cdn.fork.example/cards'},
      }));
      const mod: typeof import('@/services/widgets/surahArtwork') = require('@/services/widgets/surahArtwork');
      expect(mod.surahArtworkUrl(36)).toBe(
        'https://cdn.fork.example/cards/36.png',
      );
    });
  });
});
