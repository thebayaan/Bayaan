package expo.modules.bayaanwidgets

import org.junit.Assert.*
import org.junit.Test

class PlaybackStateTest {
  private val track = WidgetTrack(18, "Al-Kahf", "r1", "R", null, null, false)
  private fun np(playing: Boolean, pos: Double = 100.0, dur: Double = 1000.0, rate: Double = 1.0) =
    WidgetNowPlaying(track, playing, pos, dur, rate)
  private val gen = 1_000_000L

  @Test fun usesSnapshotWithoutOverride() {
    assertTrue(PlaybackState.effective(np(true), gen, null, gen + 1_000).isPlaying)
    assertFalse(PlaybackState.effective(np(false), gen, null, gen + 1_000).isPlaying)
  }

  @Test fun prefersNewerOverride() {
    val o = PlaybackOverride(isPlaying = false, at = gen + 500)
    assertFalse(PlaybackState.effective(np(true), gen, o, gen + 1_000).isPlaying)
  }

  @Test fun ignoresOverrideOlderThanSnapshot() {
    val o = PlaybackOverride(isPlaying = false, at = gen - 500)
    assertTrue(PlaybackState.effective(np(true), gen, o, gen + 1_000).isPlaying)
  }

  @Test fun overrideExpiresAfterTtl() {
    val o = PlaybackOverride(isPlaying = false, at = gen + 500)
    val ttl = PlaybackState.OVERRIDE_TTL_MS
    assertFalse(PlaybackState.effective(np(true), gen, o, o.at + ttl).isPlaying)
    assertTrue(PlaybackState.effective(np(true), gen, o, o.at + ttl + 1).isPlaying)
  }

  @Test fun stopsPlayingPastTheEndAtRate() {
    // 900 s left at 2x is 450 s of wall time.
    assertTrue(PlaybackState.effective(np(true, rate = 2.0), gen, null, gen + 449_000).isPlaying)
    assertFalse(PlaybackState.effective(np(true, rate = 2.0), gen, null, gen + 451_000).isPlaying)
  }

  @Test fun remainingWallTimeAccountsForRate() {
    val e = PlaybackState.effective(np(false, rate = 1.5), gen, null, gen + 60_000)
    assertEquals(600.0, e.remainingWallSec, 0.001)
  }

  @Test fun overrideRoundTrips() {
    val o = PlaybackOverride(true, 42L)
    assertEquals(o, PlaybackState.decodeOverride(PlaybackState.encodeOverride(o)))
    assertNull(PlaybackState.decodeOverride("nope"))
    assertNull(PlaybackState.decodeOverride(null))
  }
}
