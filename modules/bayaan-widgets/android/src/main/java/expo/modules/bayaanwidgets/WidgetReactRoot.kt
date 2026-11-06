// @ai-generated
package expo.modules.bayaanwidgets

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
 * Lets a widget tap play with the app closed or in the background, like
 * bayaan-car's CarReactRoot does for Android Auto. Main thread only.
 *
 * - Headless root: with no Activity there is no React tree, so no player and
 *   no widget sync to drain the command queue. This starts [COMPONENT]
 *   (services/widgets/WidgetRoot.tsx), which boots the app services, owns the
 *   player until the phone layout mounts, and drains the queue. It stays up
 *   for the life of the process and renders nothing once the phone app runs.
 * - Keep-alive task: React Native pauses JS timers while no React Activity is
 *   resumed, unless a headless JS task runs. Booting and loading a track use
 *   timers, so a task ([KEEP_ALIVE_TASK], never finishing on its own) runs
 *   from the tap until [release].
 */
object WidgetReactRoot {
  const val COMPONENT = "BayaanWidgetRoot"
  const val KEEP_ALIVE_TASK = "BayaanWidgetKeepAlive"

  private var surface: ReactSurface? = null
  private var keepAlive: Pair<ReactContext, Int>? = null
  private var holders = 0
  private var pendingListener: ReactInstanceEventListener? = null

  /** Starts the root if needed and keeps JS timers running until [release]. */
  fun hold(context: Context) {
    holders += 1
    val host = host(context) ?: return
    startSurface(context, host)
    startKeepAlive(host)
  }

  fun release() {
    holders = maxOf(0, holders - 1)
    if (holders == 0) finishKeepAlive()
  }

  private fun host(context: Context): ReactHost? =
    (context.applicationContext as? ReactApplication)?.reactHost

  private fun startSurface(context: Context, host: ReactHost) {
    if (surface != null) return
    runCatching {
      val created = host.createSurface(context.applicationContext, COMPONENT, null)
      created.start()
      surface = created
    }
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
        if (holders > 0) startTask(context)
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
    }
  }

  private fun finishKeepAlive() {
    val (context, taskId) = keepAlive ?: return
    keepAlive = null
    runCatching {
      val tasks = HeadlessJsTaskContext.getInstance(context)
      if (tasks.isTaskRunning(taskId)) tasks.finishTask(taskId)
    }
  }
}
