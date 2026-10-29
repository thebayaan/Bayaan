import {reciterArabicName} from './reciterNames';
import type {Reciter} from '../types/reciter';

const reciter = (name: string, nameArabic: string | null = null) =>
  ({id: 'live-id', name, name_arabic: nameArabic}) as unknown as Reciter;

describe('reciterArabicName', () => {
  it("prefers the catalog's Arabic name", () => {
    expect(reciterArabicName(reciter('Saad Al-Ghamdi', 'سعد'))).toBe('سعد');
  });

  it("falls back to the phone's table by English name, whatever the id", () => {
    expect(reciterArabicName(reciter('Saad Al-Ghamdi'))).toBe('سعد الغامدي');
    expect(reciterArabicName(reciter('saad al ghamdi'))).toBe('سعد الغامدي');
  });

  it('is null for a name the table does not know', () => {
    expect(reciterArabicName(reciter('Nobody Known'))).toBeNull();
  });
});
