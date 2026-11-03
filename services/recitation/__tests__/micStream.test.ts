// The microphone stream over react-native-audio-api: interruptions are
// reported when they begin and when they end, and resume() brings the mic
// back after one.

const mockRecorder = {
  onAudioReady: jest.fn(() => ({status: 'success'})),
  start: jest.fn(async () => ({status: 'success'}) as const),
  stop: jest.fn(async () => ({status: 'success'})),
  clearOnAudioReady: jest.fn(),
};
const mockAudio: {
  interruption: ((event: {type: string; shouldResume: boolean}) => void) | null;
} = {interruption: null};

jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    setAudioSessionOptions: jest.fn(),
    setAudioSessionActivity: jest.fn(async () => true),
    requestRecordingPermissions: jest.fn(async () => 'Granted'),
    observeAudioInterruptions: jest.fn(),
    addSystemEventListener: jest.fn(
      (
        name: string,
        listener: (event: {type: string; shouldResume: boolean}) => void,
      ) => {
        if (name === 'interruption') mockAudio.interruption = listener;
        return {remove: jest.fn()};
      },
    ),
  },
  AudioRecorder: jest.fn(() => mockRecorder),
}));

jest.mock('@/services/recitation/recitationEngine', () => ({
  RECITATION_SAMPLE_RATE: 16000,
}));

import {AudioManager} from 'react-native-audio-api';
import {startMicStream} from '../micStream';

beforeEach(() => {
  jest.clearAllMocks();
  mockAudio.interruption = null;
});

describe('startMicStream', () => {
  it('reports an interruption when it begins and when it ends', async () => {
    const phases: string[] = [];
    await startMicStream(
      () => undefined,
      phase => phases.push(phase),
    );
    mockAudio.interruption?.({type: 'began', shouldResume: false});
    mockAudio.interruption?.({type: 'ended', shouldResume: true});
    expect(phases).toEqual(['began', 'ended']);
  });

  it('resume reactivates the audio session and restarts the recorder', async () => {
    const mic = await startMicStream(() => undefined);
    await mic.resume();
    expect(AudioManager.setAudioSessionActivity).toHaveBeenCalledTimes(2);
    expect(AudioManager.setAudioSessionActivity).toHaveBeenLastCalledWith(true);
    expect(mockRecorder.start).toHaveBeenCalledTimes(2);
  });

  it('resume throws when the recorder cannot restart', async () => {
    const mic = await startMicStream(() => undefined);
    mockRecorder.start.mockResolvedValueOnce({
      status: 'error',
      message: 'input busy',
    } as never);
    await expect(mic.resume()).rejects.toThrow('input busy');
  });

  it('a stop that lands while resuming leaves the mic off', async () => {
    const mic = await startMicStream(() => undefined);
    let reactivate: () => void = () => undefined;
    (AudioManager.setAudioSessionActivity as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          reactivate = () => resolve(true);
        }),
    );
    const resuming = mic.resume();
    await mic.stop();
    reactivate();
    await resuming;
    // Only the first start: the resume must not reopen a stopped mic.
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);
  });
});
