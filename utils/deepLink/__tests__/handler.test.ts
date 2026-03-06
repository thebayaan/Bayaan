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

    test('parses reciter with rewayat slug URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatSlug: 'hafs-an-assem' },
      });
    });

    test('parses reciter with rewayat slug and surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem/surah/2?autoplay=true');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatSlug: 'hafs-an-assem', surah: '2', autoplay: true },
      });
    });

    test('parses legacy reciter with surah URL', () => {
      const result = parseDeepLink('https://thebayaan.com/reciter/al-husary/surah/2?rewayat=hafs-an-assem');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', surah: '2', rewayatSlug: 'hafs-an-assem' },
      });
    });

    test('parses surah URL with reciter and rewayat slug', () => {
      const result = parseDeepLink('https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs-an-assem');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/',
        params: { surah: '112', reciter: 'al-husary', rewayatSlug: 'hafs-an-assem' },
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

    test('handles custom scheme with rewayat slug', () => {
      const result = parseDeepLink('bayaan://reciter/al-husary/rewayat/hafs-an-assem');
      expect(result).toEqual({
        screen: '/(tabs)/(a.home)/reciter/[id]',
        params: { id: 'al-husary', rewayatSlug: 'hafs-an-assem' },
      });
    });
  });

  describe('generateShareableLink', () => {
    test('generates reciter link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary');
    });

    test('generates reciter with rewayat slug link', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary', rewayatSlug: 'hafs-an-assem' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem');
    });

    test('generates reciter with rewayat slug and surah link', () => {
      const link = generateShareableLink('reciter', { 
        id: 'al-husary', 
        rewayatSlug: 'hafs-an-assem', 
        surah: '2' 
      });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/rewayat/hafs-an-assem/surah/2');
    });

    test('generates legacy reciter with surah link (no rewayat slug)', () => {
      const link = generateShareableLink('reciter', { id: 'al-husary', surah: '2' });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/surah/2');
    });

    test('generates legacy reciter with surah and rewayat slug as query param', () => {
      const link = generateShareableLink('reciter', { 
        id: 'al-husary', 
        surah: '2', 
        rewayatSlug: 'hafs-an-assem' 
      });
      expect(link).toBe('https://thebayaan.com/reciter/al-husary/surah/2?rewayat=hafs-an-assem');
    });

    test('generates surah link', () => {
      const link = generateShareableLink('surah', { num: '112' });
      expect(link).toBe('https://thebayaan.com/surah/112');
    });

    test('generates surah link with reciter and rewayat slug', () => {
      const link = generateShareableLink('surah', { 
        num: '112', 
        reciter: 'al-husary',
        rewayatSlug: 'hafs-an-assem'
      });
      expect(link).toBe('https://thebayaan.com/surah/112?reciter=al-husary&rewayat=hafs-an-assem');
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
