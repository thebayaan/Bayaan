import {
  popularReciters,
  reciterChoicesForSurah,
  rewayahForSurah,
  rewayahLabel,
  shortReciterName,
  upcoming,
} from './listeningChoices';
import type {Reciter, Rewayah} from '../types/reciter';
import type {QueueItem} from '../types/player';

function rewayah(id: string, name: string, surahs: number[]): Rewayah {
  return {
    id,
    reciter_id: '',
    name,
    style: 'murattal',
    server: 'https://x/',
    source_type: '',
    surah_total: surahs.length,
    surah_list: surahs,
    mp3quran_read_id: null,
    qdc_reciter_id: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

function reciter(id: string, name: string, rewayat: Rewayah[]): Reciter {
  return {
    id,
    name,
    name_arabic: null,
    date: '',
    image_url: null,
    bio: null,
    slug: id,
    is_featured: false,
    is_active: true,
    created_at: '',
    updated_at: '',
    rewayat,
  };
}

const all = Array.from({length: 114}, (_, i) => i + 1);
const minshawi = reciter('m', 'Mohammed Siddiq Al-Minshawi', [
  rewayah('m1', "Hafs A'n Assem", all),
]);
const afasy = reciter('a', 'Mishary Alafasi', [
  rewayah('a1', "Warsh A'n Nafi'", [1, 2]),
  rewayah('a2', "Hafs A'n Assem", all),
]);
const zed = reciter('z', 'Zed Reciter', [rewayah('z1', 'Hafs', [1])]);
const amy = reciter('y', 'Amy Reciter', [rewayah('y1', 'Hafs', all)]);

describe('popularReciters', () => {
  it('follows the popular order and tops up from the catalog', () => {
    const picked = popularReciters([zed, afasy, minshawi], 3);
    expect(picked.map(r => r.id)).toEqual(['m', 'a', 'z']);
  });

  it('skips reciters without portraits when topping up', () => {
    const picked = popularReciters([zed, amy], 2, r => r.id === 'y');
    expect(picked.map(r => r.id)).toEqual(['y']);
  });
});

describe('rewayahForSurah', () => {
  it('prefers the same rewayah, then Hafs', () => {
    expect(rewayahForSurah(afasy, 1, 'Warsh')?.id).toBe('a1');
    expect(rewayahForSurah(afasy, 1)?.id).toBe('a2');
    expect(rewayahForSurah(afasy, 50, 'Warsh')?.id).toBe('a2');
  });

  it('is null when the reciter lacks the surah', () => {
    expect(rewayahForSurah(zed, 2)).toBeNull();
  });
});

describe('reciterChoicesForSurah', () => {
  it('orders current, preferred, popular, then by name, for reciters with the surah', () => {
    const choices = reciterChoicesForSurah([zed, amy, afasy, minshawi], 2, {
      currentId: 'y',
      preferredIds: ['a'],
      limit: 10,
    });
    expect(choices.map(c => c.reciter.id)).toEqual(['y', 'a', 'm']);
  });

  it('caps the list', () => {
    const choices = reciterChoicesForSurah([amy, afasy, minshawi], 1, {
      currentId: null,
      preferredIds: [],
      limit: 2,
    });
    expect(choices.map(c => c.reciter.id)).toEqual(['m', 'a']);
  });
});

describe('upcoming', () => {
  const queue = [1, 2, 3, 4].map(
    n =>
      ({
        reciterId: 'r',
        surahNumber: n,
        audioUrl: '',
        title: `S${n}`,
        subtitle: '',
      }) as QueueItem,
  );

  it('lists what plays next with queue indexes', () => {
    expect(
      upcoming(queue, 1, 5).map(u => [u.item.surahNumber, u.index]),
    ).toEqual([
      [3, 2],
      [4, 3],
    ]);
  });

  it('is empty at the end of the queue', () => {
    expect(upcoming(queue, 3, 5)).toEqual([]);
  });
});

describe('shortReciterName', () => {
  it('keeps names that fit', () => {
    expect(shortReciterName('Abdulbasit Abdulsamad')).toBe(
      'Abdulbasit Abdulsamad',
    );
  });

  it('shortens long names to the family name', () => {
    expect(shortReciterName('Mohammed Siddiq Al-Minshawi')).toBe('Al-Minshawi');
    expect(shortReciterName('Mahmoud Khalil Al Hussary Al Masri')).toBe(
      'Al Masri',
    );
    expect(shortReciterName('Abdulrahman Mohammed Alsudaes Bin X')).toBe('X');
  });
});

describe('rewayahLabel', () => {
  it('joins style and rewayah', () => {
    expect(rewayahLabel(rewayah('x', 'Hafs', [1]))).toBe('Murattal · Hafs');
    expect(rewayahLabel({...rewayah('x', 'Hafs', [1]), style: ''})).toBe(
      'Hafs',
    );
    expect(rewayahLabel(null)).toBe('');
  });
});
