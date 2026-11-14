import {
  quranHitLinkParams, // @ai
  quranLinkParams,
  resolveQuranLink,
} from '../quranLink';

// @ai-start
describe('quranHitLinkParams', () => {
  // A layout where 2:282 runs from page 48 (slots 1-60) onto page 49.
  const pageForWord = (verseKey: string, position: number) =>
    verseKey === '2:282' ? (position <= 60 ? 48 : 49) : undefined;

  it('anchors the first matched slot and opens its page', () => {
    expect(quranHitLinkParams('2:282', [77, 76], pageForWord)).toEqual({
      surah: '2',
      ayah: '282',
      page: '49',
      anchor: '2:282:76',
      words: '76,77',
    });
  });

  it('leaves the page out when it is not known', () => {
    expect(quranHitLinkParams('1:1', [3], pageForWord)).toEqual({
      surah: '1',
      ayah: '1',
      anchor: '1:1:3',
      words: '3',
    });
  });
});
// @ai-end

describe('quranLinkParams', () => {
  const pageFor = (key: string): number | undefined =>
    key === '18:10' ? 294 : undefined;

  it('opens the page that holds the ayah', () => {
    expect(quranLinkParams('18', '10', pageFor)).toEqual({
      surah: '18',
      ayah: '10',
      page: '294',
    });
  });

  it('falls back to the surah when the ayah has no known page', () => {
    expect(quranLinkParams('18', '999', pageFor)).toEqual({
      surah: '18',
      ayah: '999',
    });
  });

  it('passes only the surah when no ayah is given', () => {
    expect(quranLinkParams('18', undefined, pageFor)).toEqual({surah: '18'});
  });
});

describe('resolveQuranLink', () => {
  const pageFor = (key: string): number | undefined =>
    key === '18:10' ? 294 : undefined;
  const notLoaded = (): number | undefined => undefined;

  it('waits on a cold start until the ayah page is known', () => {
    expect(resolveQuranLink('18', '10', notLoaded, false)).toEqual({
      status: 'pending',
    });
  });

  it('opens the ayah page once the mushaf data has loaded', () => {
    expect(resolveQuranLink('18', '10', pageFor, false)).toEqual({
      status: 'ready',
      params: {surah: '18', ayah: '10', page: '294'},
    });
  });

  it('redirects at once on a warm start (page known, data settled)', () => {
    expect(resolveQuranLink('18', '10', pageFor, true)).toEqual({
      status: 'ready',
      params: {surah: '18', ayah: '10', page: '294'},
    });
  });

  it('falls back to the surah when loading ends without a page', () => {
    expect(resolveQuranLink('18', '10', notLoaded, true)).toEqual({
      status: 'ready',
      params: {surah: '18', ayah: '10'},
    });
    expect(resolveQuranLink('18', '999', pageFor, true)).toEqual({
      status: 'ready',
      params: {surah: '18', ayah: '999'},
    });
  });

  it('never waits for a surah-only link', () => {
    expect(resolveQuranLink('18', undefined, notLoaded, false)).toEqual({
      status: 'ready',
      params: {surah: '18'},
    });
  });
});
