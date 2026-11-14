const mockRun = jest.fn();
const mockRelease = jest.fn(async () => undefined);
const mockCreate = jest.fn(async (..._args: unknown[]) => ({
  run: mockRun,
  release: mockRelease,
}));

jest.mock('onnxruntime-react-native', () => {
  class Tensor {
    type: string;
    data: unknown;
    dims: number[];
    constructor(tensorType: string, data: unknown, dims: number[]) {
      this.type = tensorType;
      this.data = data;
      this.dims = dims;
    }
  }
  return {Tensor, InferenceSession: {create: mockCreate}};
});

import {loadSecondLookModel} from '../model';

beforeEach(() => jest.clearAllMocks());

describe('loadSecondLookModel', () => {
  it('opens the file on one thread, without the memory arena', async () => {
    await loadSecondLookModel('file:///docs/recitation/second.onnx');
    expect(mockCreate).toHaveBeenCalledWith('/docs/recitation/second.onnx', {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      enableCpuMemArena: false,
      enableMemPattern: false,
    });
  });

  it('a load failure reaches the caller', async () => {
    mockCreate.mockRejectedValueOnce(new Error('bad model'));
    await expect(loadSecondLookModel('/m.onnx')).rejects.toThrow('bad model');
  });

  it('feeds log-mel frames as x and x_lens, and reads log_probs up to log_probs_len', async () => {
    const model = await loadSecondLookModel('/m.onnx');
    const logp = new Float32Array(4 * 31).map((_, i) => i);
    mockRun.mockResolvedValueOnce({
      log_probs: {data: logp, dims: [1, 4, 31]},
      log_probs_len: {data: BigInt64Array.from([BigInt(3)]), dims: [1]},
    });
    const features = new Float32Array(16 * 80);
    const out = await model.run(features, 16);

    const [feeds] = mockRun.mock.calls[0];
    expect(Object.keys(feeds).sort()).toEqual(['x', 'x_lens']);
    expect(feeds.x).toMatchObject({type: 'float32', dims: [1, 16, 80]});
    expect(feeds.x.data).toBe(features);
    expect(feeds.x_lens).toMatchObject({type: 'int64', dims: [1]});
    expect(Array.from(feeds.x_lens.data)).toEqual([BigInt(16)]);

    expect(out.frames).toBe(3);
    expect(out.logp).toEqual(logp.slice(0, 3 * 31));
  });

  it('a failed run reaches the caller', async () => {
    const model = await loadSecondLookModel('/m.onnx');
    mockRun.mockRejectedValueOnce(new Error('out of memory'));
    await expect(model.run(new Float32Array(80), 1)).rejects.toThrow(
      'out of memory',
    );
  });

  it('release lets the session go', async () => {
    const model = await loadSecondLookModel('/m.onnx');
    await model.release();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
