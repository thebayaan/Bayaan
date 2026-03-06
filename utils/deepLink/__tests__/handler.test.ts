import { parseDeepLink, generateShareableLink } from '../handler';

describe('Deep Link Handler', () => {
  describe('parseDeepLink', () => {
    test('parses reciter URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary' },
      });
    });

    test('parses reciter with surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/surah/2?autoplay=true');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', surah: '2', autoplay: true },
      });
    });

    test('parses surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/surah/112?reciter=al-husary');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/',
        params: { surah: '112', reciter: 'al-husary' },
      });
    });

    test('parses playlist URL', () => {
      const result = parseDeepLink('https://thebayaan.com/playlist/abc123');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/playlist/[id]',
        params: { id: 'abc123' },
      });
    });

    test('parses adhkar URL', () => {
      const result = parseDeepLink('https://thebayaan.com/adhkar/morning/dhikr1');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
        params: { superId: 'morning', dhikrId: 'dhikr1' },
      });
    });

    test('handles home URL', () => {
      const result = parseDeepLink('https://thebayaan.com/');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/',
      });
    });

    test('handles custom scheme', () => {
      const result = parseDeepLink('bayaan://reciter/al-husary');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary' },
      });
    });
  });

  describe('generateShareableLink', () => {
    test('generates reciter link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary');
    });

    test('generates reciter with surah link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary', surah: '2' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/surah/2');
    });

    test('generates surah link', () => {
      const link = generateShareableLink('surah', { num: '112' });
      expect(link).toBe('https://thebayaan.com/surah/112');
    });

    test('generates surah link with reciter', () => {
      const link = generateShareableLink('surah', { num: '112', reciter: 'al-husary' });
      expect(link).toBe('https://thebayaan.com/surah/112?reciter=al-husary');
    });

    test('generates playlist link', () => {
      const link = generateShareableLink('playlist', { id: 'abc123' });
      expect(link).toBe('https://thebayaan.com/playlist/abc123');
    });
  });
});
