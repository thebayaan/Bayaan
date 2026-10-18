import {
  popularReciters,
  queueInVoice,
  reciterChoicesForSurah,
  rewayahForSurah,
  rewayahLabel,
  queueWindow,
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

describe('queueWindow', () => {
  const queue = [1, 2, 3, 4, 5, 6].map(
    n =>
      ({
        reciterId: 'r',
        surahNumber: n,
        audioUrl: '',
        title: `S${n}`,
        subtitle: '',
      }) as QueueItem,
  );
  const numbers = (w: ReturnType<typeof queueWindow>) =>
    w.map(u => [u.item.surahNumber, u.index]);

  it('shows played surahs before the current one and the next after', () => {
    expect(numbers(queueWindow(queue, 3, 2, 1))).toEqual([
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
    ]);
  });

  it('stops at both ends of the queue', () => {
    expect(numbers(queueWindow(queue, 0, 3, 1))).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(numbers(queueWindow(queue, 5, 1, 4))).toEqual([
      [5, 4],
      [6, 5],
    ]);
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
  it('joins style and rewayah in their display names', () => {
    expect(rewayahLabel(rewayah('x', "Hafs A'n Assem", [1]))).toBe(
      "Murattal · Hafs 'an 'Asim",
    );
    expect(
      rewayahLabel({...rewayah('x', "Hafs A'n Assem", [1]), style: 'molim'}),
    ).toBe("Teaching · Hafs 'an 'Asim");
    expect(
      rewayahLabel({...rewayah('x', 'Hafs', [1]), style: 'mojawwad'}),
    ).toBe("Mujawwad · Hafs 'an 'Asim");
    expect(
      rewayahLabel({...rewayah('x', 'Something New', [1]), style: ''}),
    ).toBe('Something New');
    expect(rewayahLabel(null)).toBe('');
  });
});

describe('the current reciter in the Reciter panel', () => {
  const styled = (id: string, style: string): Rewayah => ({
    ...rewayah(id, "Hafs A'n Assem", all),
    style,
  });
  const hussary = reciter('h', 'Mahmoud Khalil Al-Hussary', [
    styled('h-mj', 'mojawwad'),
    styled('h-mr', 'murattal'),
    styled('h-ml', 'molim'),
  ]);

  it('shows the recitation playing now, then its other styles', () => {
    const choices = reciterChoicesForSurah([hussary, amy], 2, {
      currentId: 'h',
      currentRewayahId: 'h-mr',
      preferredIds: [],
      limit: 10,
    });
    expect(choices.map(c => c.rewayah.id)).toEqual([
      'h-mr',
      'h-mj',
      'h-ml',
      'y1',
    ]);
  });

  it('keeps the style when switching to another reciter', () => {
    expect(rewayahForSurah(hussary, 2, 'hafs', 'murattal')?.id).toBe('h-mr');
    expect(rewayahForSurah(hussary, 2, 'hafs', 'molim')?.id).toBe('h-ml');
    expect(rewayahForSurah(hussary, 2, 'warsh', 'murattal')?.id).toBe('h-mr');
  });
});

describe('queueInVoice', () => {
  const item = (
    reciterId: string,
    rewayahId: string,
    surahNumber: number,
  ): QueueItem => ({
    reciterId,
    rewayahId,
    surahNumber,
    audioUrl: `https://${reciterId}/${surahNumber}`,
    title: `S${surahNumber}`,
    subtitle: reciterId,
  });
  // The new voice has every surah but 3.
  const swap = (q: QueueItem): QueueItem | null =>
    q.surahNumber === 3 ? null : item('new', 'n1', q.surahNumber);

  it('changes only the surah playing in a playlist', () => {
    const playlist = [
      item('a', 'a1', 1),
      item('b', 'b1', 5),
      item('a', 'a1', 9),
    ];
    const result = queueInVoice(playlist, 1, 114, swap);
    expect(result.index).toBe(1);
    expect(result.queue.map(q => `${q.reciterId}:${q.surahNumber}`)).toEqual([
      'a:1',
      'new:5',
      'a:9',
    ]);
  });

  it("keeps a filtered list of one reciter's surahs as it was", () => {
    const juz = [item('a', 'a1', 78), item('a', 'a1', 79), item('a', 'a1', 80)];
    const result = queueInVoice(juz, 0, 114, swap);
    expect(result.queue.map(q => q.reciterId)).toEqual(['new', 'a', 'a']);
  });

  it("carries a reciter's whole recitation on in the new voice, in its order", () => {
    const whole = [4, 3, 1, 2].map(n => item('a', 'a1', n));
    const result = queueInVoice(whole, 2, 4, swap);
    expect(result.queue.map(q => `${q.reciterId}:${q.surahNumber}`)).toEqual([
      'new:4',
      'new:1',
      'new:2',
    ]);
    expect(result.index).toBe(1);
  });
});
