import {quranLinkParams, resolveQuranLink} from '../quranLink';

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
