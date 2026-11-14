"""Log-mel features two independent ways, for test_fbank.mjs to compare with:
a NumPy port of the model's own recipe (code/quran_asr/features.py at the pinned
revision), and kaldi-native-fbank, the library that recipe was written to match.

    <venv with numpy and kaldi-native-fbank>/bin/python -I judge/fbank_reference.py <in.f32> <out_prefix>

Writes <out_prefix>.numpy.f32 and <out_prefix>.knf.f32, each [frames, 80].
"""
import math
import sys

import kaldi_native_fbank as knf
import numpy as np

SR = 16000
BINS = 80
SHIFT = 160
LENGTH = 400
FFT = 512
EPS = float(np.finfo(np.float32).eps)


def mel(f):
    return 1127.0 * math.log(1.0 + f / 700.0)


def banks(low=20.0, high=SR / 2 - 400.0):
    half = FFT // 2
    width = SR / FFT
    lo, hi = mel(low), mel(high)
    delta = (hi - lo) / (BINS + 1)
    out = np.zeros((BINS, half))
    for b in range(BINS):
        left, center, right = lo + b * delta, lo + (b + 1) * delta, lo + (b + 2) * delta
        for i in range(half):
            m = mel(width * i)
            if left < m < right:
                out[b, i] = (m - left) / (center - left) if m <= center else (right - m) / (right - center)
    return out.astype(np.float32)


def numpy_fbank(wave):
    n = len(wave)
    t = (n + SHIFT // 2) // SHIFT
    idx = np.arange(t)[:, None] * SHIFT + SHIFT // 2 - LENGTH // 2 + np.arange(LENGTH)[None, :]
    idx = np.where(idx < 0, -idx - 1, idx)
    idx = np.clip(np.where(idx >= n, 2 * n - 1 - idx, idx), 0, n - 1)
    frames = wave[idx].astype(np.float32)
    frames = frames - frames.mean(axis=1, keepdims=True)
    frames = np.concatenate([frames[:, :1] * (1 - 0.97), frames[:, 1:] - 0.97 * frames[:, :-1]], axis=1)
    window = np.power(0.5 - 0.5 * np.cos(2 * math.pi * np.arange(LENGTH) / (LENGTH - 1)), 0.85).astype(np.float32)
    frames = frames * window
    spectrum = np.fft.rfft(frames, n=FFT)
    power = (spectrum.real**2 + spectrum.imag**2).astype(np.float32)
    energies = power[:, : FFT // 2] @ banks().T
    return np.log(np.maximum(energies, EPS)).astype(np.float32)


def knf_fbank(wave):
    opts = knf.FbankOptions()
    opts.frame_opts.samp_freq = SR
    opts.frame_opts.dither = 0
    opts.frame_opts.snip_edges = False
    opts.frame_opts.frame_shift_ms = 10
    opts.frame_opts.frame_length_ms = 25
    opts.frame_opts.preemph_coeff = 0.97
    opts.frame_opts.remove_dc_offset = True
    opts.frame_opts.window_type = 'povey'
    opts.mel_opts.num_bins = BINS
    opts.mel_opts.low_freq = 20
    opts.mel_opts.high_freq = -400
    opts.use_energy = False
    opts.use_log_fbank = True
    opts.use_power = True
    f = knf.OnlineFbank(opts)
    f.accept_waveform(SR, wave.tolist())
    f.input_finished()
    return np.array([f.get_frame(i) for i in range(f.num_frames_ready)], dtype=np.float32)


def main():
    wave = np.fromfile(sys.argv[1], dtype=np.float32)
    numpy_fbank(wave).tofile(sys.argv[2] + '.numpy.f32')
    knf_fbank(wave).tofile(sys.argv[2] + '.knf.f32')


if __name__ == '__main__':
    main()
