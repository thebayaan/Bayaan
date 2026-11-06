package expo.modules.bayaanwidgets

import org.json.JSONObject

/** Written by a widget tap so the widget can render the expected state before JS confirms it. */
data class PlaybackOverride(val isPlaying: Boolean, val at: Long)

/** What the widget should render right now, after the override and end-of-track checks. */
data class EffectivePlayback(val isPlaying: Boolean, val remainingWallSec: Double)

object PlaybackState {
  /** Matches the 60 s max age of queued commands. */
  const val OVERRIDE_TTL_MS = 60_000L

  fun encodeOverride(o: PlaybackOverride): String =
    JSONObject().put("isPlaying", o.isPlaying).put("at", o.at).toString()

  fun decodeOverride(json: String?): PlaybackOverride? = try {
    if (json == null) null else JSONObject(json).let { PlaybackOverride(it.getBoolean("isPlaying"), it.getLong("at")) }
  } catch (e: Exception) { null }

  private fun safeRate(rate: Double): Double = if (rate > 0 && rate.isFinite()) rate else 1.0

  /**
   * Prefers the override when it is newer than the snapshot and younger than
   * OVERRIDE_TTL_MS, so a command that never lands cannot pin it. Treats playback as
   * stopped once now is past the computed end (anchor + remaining / rate).
   */
  fun effective(
    np: WidgetNowPlaying, generatedAt: Long, override: PlaybackOverride?, nowMs: Long,
  ): EffectivePlayback {
    val rate = safeRate(np.rate)
    val duration = maxOf(np.durationSec, 0.0)
    fun positionAt(t: Long): Double {
      val advanced = if (np.isPlaying) np.positionSec + (t - generatedAt) / 1000.0 * rate else np.positionSec
      return advanced.coerceIn(0.0, duration)
    }
    val applied = override?.takeIf { it.at > generatedAt && nowMs - it.at <= OVERRIDE_TTL_MS }
    val playing = applied?.isPlaying ?: np.isPlaying
    val anchorMs = applied?.at ?: generatedAt
    val anchorPos = if (applied != null) positionAt(applied.at) else np.positionSec.coerceIn(0.0, duration)
    val remainingAtAnchor = (duration - anchorPos) / rate
    val elapsed = if (playing) maxOf(0L, nowMs - anchorMs) / 1000.0 else 0.0
    val remaining = maxOf(0.0, remainingAtAnchor - elapsed)
    val ended = playing && remaining <= 0.0
    return EffectivePlayback(playing && !ended, remaining)
  }

  // @ai-start
  /** The track playing right now, after the override and end checks; null when paused or stopped. */
  fun playingTrack(snapshot: WidgetSnapshot?, override: PlaybackOverride?, nowMs: Long): WidgetTrack? {
    val np = snapshot?.nowPlaying ?: return null
    return if (effective(np, snapshot.generatedAt, override, nowMs).isPlaying) np.track else null
  }

  /** A null reciterId matches any reciter (the widget plays the default one). */
  fun matches(track: WidgetTrack?, surahId: Int, reciterId: String?): Boolean =
    track != null && track.surahId == surahId && (reciterId == null || track.reciterId == reciterId)
  // @ai-end
}
