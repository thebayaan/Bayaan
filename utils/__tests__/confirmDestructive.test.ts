// @ai-generated
import {ActionSheetIOS, Alert, Platform} from 'react-native';
import enCollection from '../../i18n/locales/en/collection.json';
import arCollection from '../../i18n/locales/ar/collection.json';
import {
  confirmDestructive,
  setConfirmationListener,
} from '../confirmDestructive';

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

function show(onConfirm: () => void | Promise<void>) {
  confirmDestructive({
    title: 'Remove All Downloads?',
    message: 'This deletes every downloaded surah.',
    confirmText: 'Remove',
    cancelText: 'Cancel',
    onConfirm,
  });
}

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('confirmDestructive', () => {
  // The alert is the Android and web prompt; iOS cases set the OS themselves.
  let os: ReturnType<typeof jest.replaceProperty>;
  beforeEach(() => {
    mockAlert.mockClear();
    os = jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    os.restore();
  });

  it('shows the alert without running the action', () => {
    const onConfirm = jest.fn();

    show(onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'Remove All Downloads?',
      'This deletes every downloaded surah.',
      expect.any(Array),
    );
  });

  it('does nothing when the user cancels', async () => {
    const onConfirm = jest.fn();

    show(onConfirm);
    const cancel = lastButtons().find(b => b.style === 'cancel');
    expect(cancel?.text).toBe('Cancel');
    cancel?.onPress?.();
    await flush();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('runs the action once after the destructive button is pressed', async () => {
    const onConfirm = jest.fn();

    show(onConfirm);
    const remove = lastButtons().find(b => b.style === 'destructive');
    expect(remove?.text).toBe('Remove');
    remove?.onPress?.();
    await flush();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('disk full'))],
    [
      'throws',
      () => {
        throw new Error('disk full');
      },
    ],
  ])('logs instead of crashing when the action %s', async (_, onConfirm) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {
      // Silence the expected error log.
    });

    show(onConfirm);
    lastButtons()
      .find(b => b.style === 'destructive')
      ?.onPress?.();
    await flush();

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('has confirmation copy for every bulk removal in every locale', () => {
    for (const locale of [enCollection, arCollection]) {
      expect(locale.downloadsScreen.removeAllTitle).toBeTruthy();
      expect(locale.downloadsScreen.removeAllConfirm).toBeTruthy();
      expect(locale.downloadsScreen.removeReciterConfirm).toContain(
        '{{reciter}}',
      );
      expect(locale.lovedScreen.unloveAllTitle).toBeTruthy();
      expect(locale.lovedScreen.unloveAllConfirm).toBeTruthy();
    }
  });

  it('hands the prompt to the iPad dialog host when one is listening', () => {
    const ios = jest.replaceProperty(Platform, 'OS', 'ios');
    const pad = Object.getOwnPropertyDescriptor(Platform, 'isPad');
    Object.defineProperty(Platform, 'isPad', {
      configurable: true,
      get: () => true,
    });
    const listener = jest.fn();
    const unsubscribe = setConfirmationListener(listener);
    try {
      show(jest.fn());
      expect(mockAlert).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({title: 'Remove All Downloads?'}),
      );
    } finally {
      unsubscribe();
      ios.restore();
      if (pad) Object.defineProperty(Platform, 'isPad', pad);
    }
  });

  it('shows an action sheet on iPhone and confirms from its first button', async () => {
    const ios = jest.replaceProperty(Platform, 'OS', 'ios');
    const pad = Object.getOwnPropertyDescriptor(Platform, 'isPad');
    Object.defineProperty(Platform, 'isPad', {
      configurable: true,
      get: () => false,
    });
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {
        // Native; the test reads the options and calls back itself.
      });
    const listener = jest.fn();
    const unsubscribe = setConfirmationListener(listener);
    try {
      const onConfirm = jest.fn();
      show(onConfirm);
      expect(mockAlert).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
      const [options, callback] = sheet.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          title: 'Remove All Downloads?',
          options: ['Remove', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        }),
      );
      callback(1);
      await flush();
      expect(onConfirm).not.toHaveBeenCalled();
      callback(0);
      await flush();
      expect(onConfirm).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      sheet.mockRestore();
      ios.restore();
      if (pad) Object.defineProperty(Platform, 'isPad', pad);
    }
  });
});
