// @ai-generated
import {localeCandidates} from '../language';

it('tries the full tag, then shorter tags, most specific first', () => {
  expect(localeCandidates('zh-Hant-TW')).toEqual([
    'zh-Hant-TW',
    'zh-Hant',
    'zh',
  ]);
  expect(localeCandidates('pt_BR')).toEqual(['pt-BR', 'pt']);
  expect(localeCandidates('am')).toEqual(['am']);
});

it('returns nothing for a missing tag', () => {
  expect(localeCandidates(null)).toEqual([]);
  expect(localeCandidates('')).toEqual([]);
});
