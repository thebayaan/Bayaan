package expo.modules.bayaancar

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.interfaces.fabric.ReactSurface
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

/**
 * Keeps JS able to play while Android Auto is connected and the phone app is
 * not in front. Main thread only.
 *
 * - Headless root: with no Activity there is no React tree, so no player and
 *   no car bridge. This starts the component registered as [COMPONENT]
 *   (CarRoot), which boots the app services and owns the player until the
 *   phone layout mounts. If the phone app is running it shares that runtime
 *   and renders nothing.
 * - Keep-alive task: React Native pauses JS timers whenever no Activity is
 *   resumed, unless a headless JS task runs. The player's load wait and the
 *   car bridge use timers, so a task ([KEEP_ALIVE_TASK], never finishing on
 *   its own) runs while a car is connected.
 */
object CarReactRoot {
  const val COMPONENT = "BayaanCarRoot"
  const val KEEP_ALIVE_TASK = "BayaanCarKeepAlive"

  private var surface: ReactSurface? = null
  private var keepAlive: Pair<ReactContext, Int>? = null
  private var carConnected = false
  private var pendingListener: ReactInstanceEventListener? = null

  val isRunning: Boolean get() = surface != null

  fun onCarConnected(context: Context) {
    carConnected = true
    val host = host(context) ?: return
    startSurface(context, host)
    startKeepAlive(host)
  }

  fun onCarDisconnected() {
    carConnected = false
    finishKeepAlive()
  }

  /** The library service is going away. */
  fun stop(context: Context) {
    onCarDisconnected()
    host(context)?.let { host -> pendingListener?.let(host::removeReactInstanceEventListener) }
    pendingListener = null
    val current = surface ?: return
    surface = null
    runCatching { current.stop() }.onFailure { CarLog.d("headless car root failed to stop: $it") }
  }

  private fun host(context: Context): ReactHost? =
    (context.applicationContext as? ReactApplication)?.reactHost

  private fun startSurface(context: Context, host: ReactHost) {
    if (surface != null) return
    runCatching {
      val created = host.createSurface(context.applicationContext, COMPONENT, null)
      created.start()
      surface = created
    }.onFailure { CarLog.d("headless car root failed to start: $it") }
  }

  private fun startKeepAlive(host: ReactHost) {
    if (keepAlive != null) return
    val current = host.currentReactContext
    if (current != null && current.hasActiveReactInstance()) {
      startTask(current)
      return
    }
    if (pendingListener != null) return
    // Called on the UI thread once the runtime (and the bundle's task registry) is up.
    val listener = object : ReactInstanceEventListener {
      override fun onReactContextInitialized(context: ReactContext) {
        host.removeReactInstanceEventListener(this)
        pendingListener = null
        if (carConnected) startTask(context)
      }
    }
    pendingListener = listener
    host.addReactInstanceEventListener(listener)
  }

  private fun startTask(context: ReactContext) {
    if (keepAlive != null) return
    runCatching {
      val config = HeadlessJsTaskConfig(KEEP_ALIVE_TASK, Arguments.createMap(), 0, true)
      keepAlive = context to HeadlessJsTaskContext.getInstance(context).startTask(config)
    }.onFailure { CarLog.d("car keep-alive task failed to start: $it") }
  }

  private fun finishKeepAlive() {
    val (context, taskId) = keepAlive ?: return
    keepAlive = null
    runCatching {
      val tasks = HeadlessJsTaskContext.getInstance(context)
      if (tasks.isTaskRunning(taskId)) tasks.finishTask(taskId)
    }.onFailure { CarLog.d("car keep-alive task failed to finish: $it") }
  }
}
