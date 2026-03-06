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

    test('parses reciter with rewayat URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/rewayat/hafs');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatId: 'hafs' },
      });
    });

    test('parses reciter with rewayat and surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/rewayat/hafs/surah/2?autoplay=true');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatId: 'hafs', surah: '2', autoplay: true },
      });
    });

    test('parses legacy reciter with surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/surah/2?rewayat=hafs');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', surah: '2', rewayatId: 'hafs' },
      });
    });

    test('parses surah URL with reciter and rewayat', () => {
      const result = parseDeepLink('https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/',
        params: { surah: '112', reciter: 'al-husary', rewayatId: 'hafs' },
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

    test('handles custom scheme with rewayat', () => {
      const result = parseDeepLink('bayaan://reciter/al-husary/rewayat/hafs');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatId: 'hafs' },
      });
    });
  });

  describe('generateShareableLink', () => {
    test('generates reciter link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary');
    });

    test('generates reciter with rewayat link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary', rewayatId: 'hafs' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/rewayat/hafs');
    });

    test('generates reciter with rewayat and surah link', () => {
      const link = generateShareableLink('reciter', { 
        id: 'al-husary', 
        rewayatId: 'hafs', 
        surah: '2' 
      });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/rewayat/hafs/surah/2');
    });

    test('generates legacy reciter with surah link (no rewayat)', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary', surah: '2' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/surah/2');
    });

    test('generates legacy reciter with surah and rewayat as query param', () => {
      const link = generateShareableLink('reciter', { 
        id: 'al-husary', 
        surah: '2', 
        rewayatId: 'hafs' 
      });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/surah/2?rewayat=hafs');
    });

    test('generates surah link', () => {
      const link = generateShareableLink('surah', { num: '112' });
      expect(link).toBe('https://thebayaan.com/surah/112');
    });

    test('generates surah link with reciter and rewayat', () => {
      const link = generateShareableLink('surah', { 
        num: '112', 
        reciter: 'al-husary',
        rewayatId: 'hafs'
      });
      expect(link).toBe('https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs');
    });

    test('generates playlist link', () => {
      const link = generateShareableLink('playlist', { id: 'abc123' });
      expect(link).toBe('https://thebayaan.com/playlist/abc123');
    });

    test('generates adhkar link', () => {
      const link = generateShareableLink('adhkar', { superId: 'morning', dhikrId: 'dhikr1' });
      expect(link).toBe('https://thebayaan.com/adhkar/morning/dhikr1');
    });
  });
});
