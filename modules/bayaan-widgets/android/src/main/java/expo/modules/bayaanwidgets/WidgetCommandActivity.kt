package expo.modules.bayaanwidgets

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
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
 * are paused while the app is backgrounded, so anything JS must do runs with
 * the app in front. Play/pause on a live media session stays in place.
 */
class WidgetCommandActivity : Activity() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Recreated after a configuration change: the first instance already ran it.
    if (savedInstanceState != null) {
      finish()
      return
    }
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
      queueAndOpenApp(context, command)
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
    queueAndOpenApp(context, command)
  }

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

  private suspend fun queueAndOpenApp(context: Context, command: JSONObject) {
    withContext(Dispatchers.IO) { WidgetStorage.enqueueCommand(context, command) }
    // Allowed from a foreground activity; the app drains the queue once active.
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { startActivity(it) }
    }
  }

  companion object {
    const val EXTRA_COMMAND = "command"
    private const val AUDIO_SERVICE = "expo.modules.audio.service.AudioControlsService"
    private const val CONTROLLER_TIMEOUT_MS = 3_000L

    fun intent(context: Context, command: JSONObject): Intent =
      Intent(context, WidgetCommandActivity::class.java)
        .putExtra(EXTRA_COMMAND, command.toString())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
  }
}
