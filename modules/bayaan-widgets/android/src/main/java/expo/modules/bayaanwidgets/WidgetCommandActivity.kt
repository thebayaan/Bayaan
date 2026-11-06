package expo.modules.bayaanwidgets

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager // @ai
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay // @ai
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Invisible target of every widget tap. A broadcast receiver cannot open the
 * app on Android 14+ (background activity launch is blocked), and JS timers
 * are paused while the app is backgrounded. Play/pause on a live media
 * session stays in place.
 *
 * Anything JS must do runs in [WidgetReactRoot], a headless React root, while
 * this activity stays up (touch-through, nothing drawn) until JS has handled
 * the command. Being visible keeps the app in the foreground, which Android
 * requires for the player to start its foreground media service. If JS does
 * not answer in time, the app opens and drains the queue itself.
 */ // @ai
class WidgetCommandActivity : Activity() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Recreated after a configuration change: the first instance already ran it.
    if (savedInstanceState != null) {
      finish()
      return
    }
    // Touches go to the home screen underneath while this waits. // @ai
    window.addFlags( // @ai
      WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE) // @ai
    val raw = intent.getStringExtra(EXTRA_COMMAND)
    val command = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
    if (command == null) {
      finish()
      return
    }
    scope.launch {
      try {
        handle(applicationContext, command)
      } catch (e: Exception) {
        // nothing else to do; the widget re-renders on the next snapshot
      } finally {
        finish()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, 0)
        } else {
          @Suppress("DEPRECATION")
          overridePendingTransition(0, 0)
        }
      }
    }
  }

  override fun onDestroy() {
    scope.cancel()
    super.onDestroy()
  }

  private suspend fun handle(context: Context, command: JSONObject) {
    if (command.optString("type") != "setPlayback") {
      playInBackground(context, command) // @ai
      return
    }
    val playing = command.optBoolean("playing")
    // Optimistic render before anything slow. Prefs commits stay off main.
    withContext(Dispatchers.IO) {
      WidgetStorage.writePlaybackOverride(context, PlaybackOverride(playing, System.currentTimeMillis()))
    }
    runCatching { ContinueListeningWidget.pushState(context) }
    runCatching { OverrideExpiryWorker.schedule(context) }
    // JS is alive: play/pause need no JS timers, so it can drain in place.
    if (WidgetStorage.onCommandQueued != null) {
      withContext(Dispatchers.IO) { WidgetStorage.enqueueCommand(context, command) }
      return
    }
    if (controlSession(context, playing)) return
    playInBackground(context, command) // @ai
  }

  // @ai-start
  /** Queues the command for the headless root and waits until JS has handled it. */
  private suspend fun playInBackground(context: Context, command: JSONObject) {
    val enqueuedAt = withContext(Dispatchers.IO) { WidgetStorage.enqueueCommand(context, command) }
    WidgetReactRoot.hold(context)
    try {
      val handled = withTimeoutOrNull(HANDLE_TIMEOUT_MS) {
        while (!withContext(Dispatchers.IO) { WidgetStorage.isHandled(context, enqueuedAt) }) {
          delay(HANDLE_POLL_MS)
        }
        true
      } ?: false
      if (handled) {
        // Stay visible while the player promotes its service to the foreground.
        delay(FOREGROUND_GRACE_MS)
      } else {
        openApp(context)
      }
    } finally {
      WidgetReactRoot.release()
    }
  }
  // @ai-end

  /** Returns true when a live session with a loaded item took the command. */
  private suspend fun controlSession(context: Context, playing: Boolean): Boolean {
    var controller: MediaController? = null
    try {
      val token = SessionToken(context, ComponentName(context, AUDIO_SERVICE))
      val future = MediaController.Builder(context, token).buildAsync()
      controller = withTimeoutOrNull(CONTROLLER_TIMEOUT_MS) { future.await() }
      if (controller == null) {
        // Timed out; if it connects anyway, release it then.
        future.addListener({ runCatching { future.get().release() } }, MoreExecutors.directExecutor())
        return false
      }
      if (controller.currentMediaItem == null) return false
      if (playing) controller.play() else controller.pause()
      return true
    } catch (e: Exception) {
      return false // fall through to queue + open
    } finally {
      controller?.let { runCatching { it.release() } }
    }
  }

  private suspend fun <T> ListenableFuture<T>.await(): T = suspendCancellableCoroutine { cont ->
    addListener({
      try {
        cont.resume(get())
      } catch (e: Exception) {
        cont.resumeWithException(e)
      }
    }, MoreExecutors.directExecutor())
    cont.invokeOnCancellation { cancel(false) }
  }

  /** The command is already queued; the app drains it once active. */ // @ai
  private fun openApp(context: Context) { // @ai
    // Allowed from a foreground activity.
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(it) }
    }
  }

  companion object {
    const val EXTRA_COMMAND = "command"
    private const val AUDIO_SERVICE = "expo.modules.audio.service.AudioControlsService"
    private const val CONTROLLER_TIMEOUT_MS = 3_000L
    // @ai-start
    // A cold start boots React, restores the session and loads the track; an
    // emulator took up to 10.4 s, so leave room for slower phones under load.
    private const val HANDLE_TIMEOUT_MS = 20_000L
    private const val HANDLE_POLL_MS = 100L
    private const val FOREGROUND_GRACE_MS = 1_500L
    // @ai-end

    fun intent(context: Context, command: JSONObject): Intent =
      Intent(context, WidgetCommandActivity::class.java)
        .putExtra(EXTRA_COMMAND, command.toString())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
  }
}
