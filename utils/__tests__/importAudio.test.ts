// @ai-generated
/**
 * After an import, the temporary copy the file was imported from is deleted
 * when it is in the app's cache folder, and nothing outside that folder ever
 * is. (pickAndImportAudioFiles itself loads the picker with a dynamic
 * import, which this Jest setup cannot run.)
 */
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///var/mobile/App/Library/Caches/',
  deleteAsync: jest.fn(async () => undefined),
}));

import {deleteImportCacheCopy} from '../importAudio';

const deleteAsync = FileSystem.deleteAsync as jest.Mock;

const COPY = 'file:///var/mobile/App/Library/Caches/DocumentPicker/a.mp3';

beforeEach(() => {
  jest.clearAllMocks();
});

it('deletes a copy in the cache folder', async () => {
  await deleteImportCacheCopy(COPY);
  expect(deleteAsync).toHaveBeenCalledWith(COPY, {idempotent: true});
});

it("recognises the cache folder under iOS's /private alias", async () => {
  const aliased = COPY.replace('file:///var/', 'file:///private/var/');
  await deleteImportCacheCopy(aliased);
  expect(deleteAsync).toHaveBeenCalledWith(aliased, {idempotent: true});
});

it('recognises a percent-escaped path', async () => {
  const escaped = COPY.replace('a.mp3', 'my%20file.mp3');
  await deleteImportCacheCopy(escaped);
  expect(deleteAsync).toHaveBeenCalledWith(escaped, {idempotent: true});
});

it("never deletes a file outside the cache folder, the user's own", async () => {
  await deleteImportCacheCopy(
    'file:///var/mobile/Shared/AppGroup/X/shared.mp3',
  );
  await deleteImportCacheCopy(
    'file:///var/mobile/App/Library/CachesOther/a.mp3',
  );
  await deleteImportCacheCopy('file:///var/mobile/App/Documents/a.mp3');
  await deleteImportCacheCopy('content://media/external/audio/12');
  expect(deleteAsync).not.toHaveBeenCalled();
});

it('does not fail the import when the copy cannot be deleted', async () => {
  deleteAsync.mockRejectedValueOnce(new Error('busy'));
  await expect(deleteImportCacheCopy(COPY)).resolves.toBeUndefined();
});
