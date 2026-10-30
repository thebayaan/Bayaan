// @ai-generated
import {Alert, Platform} from 'react-native';
import enCollection from '../../i18n/locales/en/collection.json';
import arCollection from '../../i18n/locales/ar/collection.json';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {t: (key: string) => key},
}));

import {confirmRemoveAllUploads} from '../confirmRemoveAllUploads';

type AlertButton = {
  text: string;
  style?: string;
  onPress?: () => void;
};

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {
  // Alert is native; tests read the buttons from the recorded call.
});

function lastButtons(): AlertButton[] {
  return mockAlert.mock.calls[
    mockAlert.mock.calls.length - 1
  ][2] as AlertButton[];
}

describe('confirmRemoveAllUploads', () => {
  // The alert is the Android and web prompt (iOS uses native dialogs).
  let os: ReturnType<typeof jest.replaceProperty>;
  beforeEach(() => {
    mockAlert.mockClear();
    os = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    os.restore();
  });

  it('asks for confirmation instead of deleting immediately', () => {
    const deleteAll = jest.fn(() => Promise.resolve());

    confirmRemoveAllUploads(deleteAll);

    expect(deleteAll).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'collection:uploadsScreen.removeAllTitle',
      'collection:uploadsScreen.removeAllConfirm',
      expect.any(Array),
    );
  });

  it('does nothing when the user cancels', () => {
    const deleteAll = jest.fn(() => Promise.resolve());

    confirmRemoveAllUploads(deleteAll);
    const cancel = lastButtons().find(b => b.style === 'cancel');
    cancel?.onPress?.();

    expect(cancel).toBeDefined();
    expect(deleteAll).not.toHaveBeenCalled();
  });

  it('deletes all uploads only after the destructive button is pressed', async () => {
    const deleteAll = jest.fn(() => Promise.resolve());

    confirmRemoveAllUploads(deleteAll);
    const remove = lastButtons().find(b => b.style === 'destructive');
    expect(remove?.text).toBe('common:actions.remove');
    remove?.onPress?.();
    await Promise.resolve();

    expect(deleteAll).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed delete so it is not an unhandled rejection', async () => {
    const error = new Error('disk full');
    const deleteAll = jest.fn(() => Promise.reject(error));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
      // Silence the expected error log.
    });

    confirmRemoveAllUploads(deleteAll);
    lastButtons()
      .find(b => b.style === 'destructive')
      ?.onPress?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(
      'Error removing all uploads:',
      error,
    );
    consoleError.mockRestore();
  });

  it('has confirmation copy in every locale', () => {
    for (const locale of [enCollection, arCollection]) {
      expect(locale.uploadsScreen.removeAllTitle).toBeTruthy();
      expect(locale.uploadsScreen.removeAllConfirm).toBeTruthy();
    }
  });
});
