import {ADHKAR_LISTS, adhkarCount} from './adhkarData';
import {
  FEATURED_COUNT,
  adhkarGroups,
  countLabel,
  estimateMinutes,
  groupLists,
  listGradient,
  listSubtitle,
  mixHex,
  nowListId,
} from './adhkarBrowse';

const at = (hour: number, minute = 0): Date =>
  new Date(2026, 9, 16, hour, minute);

describe('adhkar grouping', () => {
  it('shows the chips in order, All last with every list', () => {
    const groups = adhkarGroups();
    expect(groups.map(g => g.label)).toEqual([
      'Daily',
      'Prayer',
      'Home',
      'Travel',
      'Hardship',
      'All',
    ]);
    const all = groups[groups.length - 1];
    expect(new Set(all.listIds).size).toBe(ADHKAR_LISTS.length);
  });

  it('puts every list under at least one chip besides All', () => {
    const grouped = new Set(
      adhkarGroups()
        .filter(g => g.id !== 'all')
        .flatMap(g => g.listIds),
    );
    for (const list of ADHKAR_LISTS) expect(grouped.has(list.id)).toBe(true);
  });

  it('holds only known lists, without repeats inside a chip', () => {
    for (const group of adhkarGroups()) {
      expect(new Set(group.listIds).size).toBe(group.listIds.length);
    }
  });

  it('features the everyday lists first in Daily and All', () => {
    for (const id of ['daily', 'all'] as const) {
      const {featured, rest} = groupLists(id);
      expect(featured.map(l => l.id)).toEqual([
        'morning-adhkar',
        'evening-adhkar',
        'before-sleep',
        'after-salah',
      ]);
      expect(rest.length).toBeGreaterThan(0);
    }
  });

  it('features at most four lists', () => {
    const {featured, rest} = groupLists('travel');
    expect(featured.length).toBeLessThanOrEqual(FEATURED_COUNT);
    expect(rest).toEqual([]);
  });
});

describe('the list for now', () => {
  it('is morning adhkar from 04:00 to 14:59', () => {
    expect(nowListId(at(4))).toBe('morning-adhkar');
    expect(nowListId(at(6, 41))).toBe('morning-adhkar');
    expect(nowListId(at(14, 59))).toBe('morning-adhkar');
  });

  it('is evening adhkar from 15:00 to 20:59', () => {
    expect(nowListId(at(15))).toBe('evening-adhkar');
    expect(nowListId(at(20, 59))).toBe('evening-adhkar');
  });

  it('is before sleep through the night', () => {
    expect(nowListId(at(21))).toBe('before-sleep');
    expect(nowListId(at(0, 30))).toBe('before-sleep');
    expect(nowListId(at(3, 59))).toBe('before-sleep');
  });
});

describe('card lines', () => {
  it('every list has adhkar', () => {
    for (const list of ADHKAR_LISTS) {
      expect(adhkarCount(list.id)).toBeGreaterThan(0);
    }
  });

  it('counts and estimates minutes', () => {
    expect(countLabel(1)).toBe('1 dhikr');
    expect(countLabel(4)).toBe('4 adhkar');
    const minutes = estimateMinutes('morning-adhkar');
    expect(minutes).toBeGreaterThanOrEqual(5);
    expect(minutes).toBeLessThanOrEqual(30);
    expect(listSubtitle('morning-adhkar', true)).toBe(
      `${adhkarCount('morning-adhkar')} adhkar · ${minutes} min`,
    );
  });

  it('mixes colours for the card gradient', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#F59E0B', '#000', 0)).toBe('#f59e0b');
    expect(listGradient('#F59E0B')).toHaveLength(2);
  });
});
