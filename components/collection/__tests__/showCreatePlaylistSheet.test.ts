// @ai-generated
/**
 * SheetManager.show() resolves once per call when the sheet closes. Two
 * calls for the one create / rename sheet (a double tap on "Create new
 * playlist" or "Edit") both resolved with the saved name, and the playlist
 * was then created or renamed twice in the same tick.
 */
const mockShow = jest.fn();

jest.mock('react-native-actions-sheet', () => ({
  SheetManager: {show: (...args: unknown[]) => mockShow(...args)},
}));

import {showCreatePlaylistSheet} from '../showCreatePlaylistSheet';

type Result = {name: string; color: string} | undefined;

let closeSheet: (result: Result) => void = () => undefined;

beforeEach(() => {
  mockShow.mockReset();
  mockShow.mockImplementation(
    () =>
      new Promise<Result>(resolve => {
        closeSheet = resolve;
      }),
  );
});

it('a second call while the sheet is open opens nothing and gives no result', async () => {
  const first = showCreatePlaylistSheet({existingColors: []});
  const second = showCreatePlaylistSheet({existingColors: []});

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(mockShow).toHaveBeenCalledWith('create-playlist', {
    payload: {existingColors: []},
  });
  await expect(second).resolves.toBeUndefined();

  closeSheet({name: 'Morning', color: '#6366F1'});
  await expect(first).resolves.toEqual({name: 'Morning', color: '#6366F1'});
});

it('can be opened again after it has closed', async () => {
  const first = showCreatePlaylistSheet({});
  closeSheet(undefined);
  await expect(first).resolves.toBeUndefined();

  const second = showCreatePlaylistSheet({isEditMode: true});
  expect(mockShow).toHaveBeenCalledTimes(2);
  closeSheet({name: 'Evening', color: '#10B981'});
  await expect(second).resolves.toEqual({name: 'Evening', color: '#10B981'});
});

it('can be opened again after opening it failed', async () => {
  mockShow.mockRejectedValueOnce(new Error('no sheet provider'));
  await expect(showCreatePlaylistSheet({})).rejects.toThrow(
    'no sheet provider',
  );

  const next = showCreatePlaylistSheet({});
  expect(mockShow).toHaveBeenCalledTimes(2);
  closeSheet(undefined);
  await next;
});
