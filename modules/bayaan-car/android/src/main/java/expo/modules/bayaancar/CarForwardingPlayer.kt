package expo.modules.bayaancar

import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * Mirrors expo-audio's state (pushed from JS) and forwards every command to
 * JS. It never plays audio itself.
 */
@UnstableApi
class CarForwardingPlayer(looper: Looper) : SimpleBasePlayer(looper) {
  private val listener: () -> Unit = { invalidateState() }

  /**
   * A controller that starts a media item sends setMediaItems, prepare, then
   * play. The play request already starts playback in JS, so the first play
   * command after one would only resume the previous item for a moment. It is
   * consumed once, and expires so a later user play is never swallowed.
   */
  private var playRequestExpiresAtMs = 0L

  init {
    CarBridge.onNowPlayingChanged.add(listener)
    CarBridge.onJsUnavailableChanged.add(listener)
  }

  fun detach() {
    CarBridge.onNowPlayingChanged.remove(listener)
    CarBridge.onJsUnavailableChanged.remove(listener)
  }

  fun notePlayRequestSent() {
    playRequestExpiresAtMs = SystemClock.elapsedRealtime() + PLAY_SUPPRESS_MS
  }

  fun hasRecentPlayRequest(): Boolean = SystemClock.elapsedRealtime() < playRequestExpiresAtMs

  override fun getState(): State {
    val np = CarBridge.nowPlaying
    val commands = Player.Commands.Builder().addAll(
      Player.COMMAND_PLAY_PAUSE,
      Player.COMMAND_PREPARE,
      Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_NEXT,
      Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_PREVIOUS,
      Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_MEDIA_ITEM,
      Player.COMMAND_SET_SPEED_AND_PITCH,
      Player.COMMAND_SET_REPEAT_MODE,
      Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
      Player.COMMAND_GET_TIMELINE,
      Player.COMMAND_GET_METADATA,
      Player.COMMAND_SET_MEDIA_ITEM,
    ).build()
    // Android Auto shows a player error on its Now Playing screen.
    if (CarBridge.jsUnavailable) {
      return State.Builder()
        .setAvailableCommands(commands)
        .setPlaybackState(Player.STATE_IDLE)
        .setPlayerError(PlaybackException(CarRequestGate.UNAVAILABLE_MESSAGE, null, PlaybackException.ERROR_CODE_UNSPECIFIED))
        .build()
    }
    if (np == null || np.queue.isEmpty()) {
      return State.Builder().setAvailableCommands(commands).setPlaybackState(Player.STATE_IDLE).build()
    }
    val currentIndex = np.currentIndex.coerceIn(0, np.queue.size - 1)
    val durationMs = if (np.durationSec > 0) (np.durationSec * 1000).toLong() else 0L
    val playlist = np.queue.mapIndexed { index, entry ->
      val metadata = MediaMetadata.Builder()
        .setTitle(entry.title)
        .setArtist(entry.subtitle)
        .setIsPlayable(true)
        .setIsBrowsable(false)
        .apply { entry.surahId?.let { setArtworkUri(CarArtworkProvider.uriFor(CarArtwork.Surah(it))) } }
        .build()
      val item = MediaItem.Builder().setMediaId("queue:$index").setMediaMetadata(metadata).build()
      val builder = MediaItemData.Builder("queue:$index").setMediaItem(item)
      if (index == currentIndex && durationMs > 0) builder.setDurationUs(durationMs * 1000)
      builder.build()
    }
    fun clamp(ms: Long): Long = if (durationMs > 0) ms.coerceIn(0L, durationMs) else ms.coerceAtLeast(0L)
    val anchorMs = clamp((np.positionSec * 1000).toLong())
    val rate = np.rate
    // Advance from the moment JS pushed the position, so getState() running later stays accurate.
    val position = if (np.isPlaying) {
      PositionSupplier { clamp(anchorMs + ((SystemClock.elapsedRealtime() - np.receivedAtMs) * rate).toLong()) }
    } else {
      PositionSupplier.getConstant(anchorMs)
    }
    return State.Builder()
      .setAvailableCommands(commands)
      .setPlaylist(playlist)
      .setCurrentMediaItemIndex(currentIndex)
      .setPlaybackState(Player.STATE_READY)
      .setPlayWhenReady(np.isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
      .setPlaybackParameters(PlaybackParameters(rate.toFloat()))
      .setRepeatMode(
        when (np.repeatMode) {
          "track" -> Player.REPEAT_MODE_ONE
          "queue" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        },
      )
      .setContentPositionMs(position)
      .build()
  }

  private fun transport(kind: String, extra: (JSONObject) -> Unit = {}): ListenableFuture<*> {
    val o = JSONObject().put("kind", kind)
    extra(o)
    CarBridge.sendTransport(o.toString())
    return Futures.immediateVoidFuture()
  }

  override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
    if (playWhenReady && hasRecentPlayRequest()) {
      playRequestExpiresAtMs = 0L
      return Futures.immediateVoidFuture()
    }
    return transport(if (playWhenReady) "play" else "pause")
  }

  // The real queue comes from JS; media items set by a controller are handled in the session callback.
  override fun handleSetMediaItems(mediaItems: List<MediaItem>, startIndex: Int, startPositionMs: Long): ListenableFuture<*> =
    Futures.immediateVoidFuture()

  override fun handlePrepare(): ListenableFuture<*> = Futures.immediateVoidFuture()

  override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> = when (seekCommand) {
    Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> transport("next")
    Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> transport("previous")
    Player.COMMAND_SEEK_TO_MEDIA_ITEM -> transport("jumpTo") { it.put("index", mediaItemIndex) }
    else -> transport("seek") { it.put("position", positionMs / 1000.0) }
  }

  override fun handleSetPlaybackParameters(playbackParameters: PlaybackParameters): ListenableFuture<*> =
    transport("rate") { it.put("value", playbackParameters.speed.toDouble()) }

  // parse.ts has no explicit repeat mode, so the request cycles JS's own mode.
  override fun handleSetRepeatMode(repeatMode: Int): ListenableFuture<*> = transport("cycleRepeat")

  private companion object {
    const val PLAY_SUPPRESS_MS = 2000L
  }
}
