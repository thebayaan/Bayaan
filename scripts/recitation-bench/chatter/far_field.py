"""Makes speech sound like it comes from across a room.

A person nearby is not at the phone's microphone: most of what arrives is the
room. Used on the chatter only, never on recitation. Needs numpy.
"""
import numpy as np

BLOCK = 1 << 17


def synthetic_rir(rng, rt60, drr_db, sr=16000):
    """Room response: a direct sound, then noise fading 60 dB over rt60 seconds,
    with the highs lost to the walls. drr_db is direct over reverberant energy."""
    n = int(sr * (1.2 * rt60 + 0.1))
    fade = np.exp(-6.908 * np.arange(n) / (rt60 * sr))
    tail = rng.normal(size=n) * fade
    a = float(np.exp(-2 * np.pi * 4000 / sr))
    state = 0.0
    for i in range(n):
        state = (1 - a) * tail[i] + a * state
        tail[i] = state
    tail[0] = 0.0
    tail *= np.sqrt(10 ** (-drr_db / 10) / np.sum(tail**2))
    tail[0] = 1.0
    return tail.astype(np.float32)


def convolve(x, h):
    """Overlap-add convolution, same length as x."""
    size = 1 << int(np.ceil(np.log2(BLOCK + len(h))))
    spectrum = np.fft.rfft(h, size)
    out = np.zeros(len(x) + size, dtype=np.float64)
    for start in range(0, len(x), BLOCK):
        block = x[start : start + BLOCK]
        out[start : start + size] += np.fft.irfft(np.fft.rfft(block, size) * spectrum, size)
    return out[: len(x)].astype(np.float32)
