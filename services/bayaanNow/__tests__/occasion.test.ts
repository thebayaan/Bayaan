// @ai-generated
import {activeSlots, parseOccasion} from '../occasion';

const payload = {
  id: 'qadr-1448',
  startsAt: '2027-03-04T18:00:00Z',
  endsAt: '2027-03-05T04:00:00Z',
  slots: [
    {
      action: {kind: 'surah', surahId: 97},
      look: {kind: 'sky', preset: 'ramadan'},
      content: {label: {en: 'Tonight', ar: 'الليلة'}},
    },
    {look: {kind: 'image', uri: 'https://x.test/a.jpg'}},
    {action: {kind: 'adhkar', superId: 'never-used'}},
  ],
};

describe('parseOccasion', () => {
  it('reads up to two slots', () => {
    const occasion = parseOccasion(payload);
    expect(occasion?.slots).toHaveLength(2);
    expect(occasion?.slots[0].action).toEqual({
      kind: 'surah',
      surahId: 97,
      reciterId: undefined,
      rewayatId: undefined,
    });
    expect(occasion?.slots[1]).toEqual({
      look: {
        kind: 'image',
        uri: 'https://x.test/a.jpg',
        tint: undefined,
        scrim: undefined,
      },
    });
  });

  it('rejects what it cannot use', () => {
    expect(parseOccasion(null)).toBeNull();
    expect(parseOccasion({...payload, endsAt: payload.startsAt})).toBeNull();
    expect(parseOccasion({...payload, startsAt: 'soon'})).toBeNull();
    expect(
      parseOccasion({
        ...payload,
        slots: [{action: {kind: 'surah', surahId: 115}}],
      }),
    ).toBeNull();
  });
});

describe('activeSlots', () => {
  it('only while the occasion is on', () => {
    const occasion = parseOccasion(payload);
    expect(activeSlots(occasion, new Date('2027-03-04T17:59:00Z'))).toBeNull();
    expect(
      activeSlots(occasion, new Date('2027-03-04T22:00:00Z')),
    ).toHaveLength(2);
    expect(activeSlots(occasion, new Date('2027-03-05T04:00:00Z'))).toBeNull();
  });
});
