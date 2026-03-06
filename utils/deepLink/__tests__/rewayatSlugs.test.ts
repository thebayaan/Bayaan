import { rewayatNameToSlug, findRewayatBySlug, generateRewayatSlug, getDefaultRewayatSlug } from '../rewayatSlugs';
import { Rewayat } from '@/data/reciterData';

describe('Rewayat Slug Utilities', () => {
  const mockRewayat: Rewayat[] = [
    {
      id: 'uuid-1',
      reciter_id: 'reciter-1',
      name: 'Hafs A\'n Assem',
      style: 'murattal',
      server: 'https://example.com',
      surah_total: 114,
      surah_list: [1, 2, 3],
      source_type: 'mp3quran',
      created_at: '2023-01-01'
    },
    {
      id: 'uuid-2',
      reciter_id: 'reciter-1',
      name: 'Warsh A\'n Nafi\'',
      style: 'murattal',
      server: 'https://example.com',
      surah_total: 114,
      surah_list: [1, 2, 3],
      source_type: 'mp3quran',
      created_at: '2023-01-01'
    },
    {
      id: 'uuid-3',
      reciter_id: 'reciter-1',
      name: 'Qalun A\'n Nafi\'',
      style: 'mojawwad',
      server: 'https://example.com',
      surah_total: 114,
      surah_list: [1, 2, 3],
      source_type: 'mp3quran',
      created_at: '2023-01-01'
    }
  ];

  describe('rewayatNameToSlug', () => {
    test('converts Hafs A\'n Assem to slug', () => {
      expect(rewayatNameToSlug('Hafs A\'n Assem')).toBe('hafs-an-assem');
    });

    test('converts Warsh A\'n Nafi\' to slug', () => {
      expect(rewayatNameToSlug('Warsh A\'n Nafi\'')).toBe('warsh-an-nafi');
    });

    test('handles special characters and spaces', () => {
      expect(rewayatNameToSlug('Duri A\'n Al-Kisa\'i')).toBe('duri-an-al-kisai');
    });

    test('handles multiple hyphens', () => {
      expect(rewayatNameToSlug('Test   Multiple   Spaces')).toBe('test-multiple-spaces');
    });

    test('removes leading/trailing hyphens', () => {
      expect(rewayatNameToSlug('  -Test Name-  ')).toBe('test-name');
    });
  });

  describe('generateRewayatSlug', () => {
    test('generates slug from rewayat object', () => {
      const slug = generateRewayatSlug(mockRewayat[0]);
      expect(slug).toBe('hafs-an-assem');
    });
  });

  describe('findRewayatBySlug', () => {
    test('finds rewayat by exact slug match', () => {
      const found = findRewayatBySlug(mockRewayat, 'hafs-an-assem');
      expect(found).toBe(mockRewayat[0]);
    });

    test('finds rewayat by partial match (hafs)', () => {
      const found = findRewayatBySlug(mockRewayat, 'hafs');
      expect(found?.name).toBe('Hafs A\'n Assem');
    });

    test('finds rewayat by partial match (warsh)', () => {
      const found = findRewayatBySlug(mockRewayat, 'warsh');
      expect(found?.name).toBe('Warsh A\'n Nafi\'');
    });

    test('finds rewayat by partial match (qalun)', () => {
      const found = findRewayatBySlug(mockRewayat, 'qalun');
      expect(found?.name).toBe('Qalun A\'n Nafi\'');
    });

    test('finds rewayat by UUID (fallback)', () => {
      const found = findRewayatBySlug(mockRewayat, 'uuid-2');
      expect(found).toBe(mockRewayat[1]);
    });

    test('returns null for non-existent slug', () => {
      const found = findRewayatBySlug(mockRewayat, 'non-existent');
      expect(found).toBeNull();
    });

    test('handles case-insensitive matching', () => {
      const found = findRewayatBySlug(mockRewayat, 'HAFS-AN-ASSEM');
      expect(found?.name).toBe('Hafs A\'n Assem');
    });
  });

  describe('getDefaultRewayatSlug', () => {
    test('returns Hafs slug when available', () => {
      const defaultSlug = getDefaultRewayatSlug(mockRewayat);
      expect(defaultSlug).toBe('hafs-an-assem');
    });

    test('returns first rewayat slug when no Hafs available', () => {
      const nonHafsRewayat = mockRewayat.filter(r => !r.name.includes('Hafs'));
      const defaultSlug = getDefaultRewayatSlug(nonHafsRewayat);
      expect(defaultSlug).toBe('warsh-an-nafi');
    });

    test('returns null for empty array', () => {
      const defaultSlug = getDefaultRewayatSlug([]);
      expect(defaultSlug).toBeNull();
    });
  });
});
