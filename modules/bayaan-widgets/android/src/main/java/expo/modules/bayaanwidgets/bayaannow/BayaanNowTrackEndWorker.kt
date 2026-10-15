// bayaannow/BayaanNowTrackEndWorker.kt
package expo.modules.bayaanwidgets.bayaannow

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import expo.modules.bayaanwidgets.GlanceState
import java.util.concurrent.TimeUnit

/** Re-renders Bayaan Now just after the playing track ends, so it stops showing Pause with the app gone. */
class BayaanNowTrackEndWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    runCatching { GlanceState.push(applicationContext, BayaanNowWidget()) }
    return Result.success()
  }

  companion object {
    private const val NAME = "bayaan-widgets-bayaan-now-track-end"

    /** Replaces any pending run; a null end (nothing playing) cancels it. */
    fun schedule(context: Context, endMs: Long?, nowMs: Long) {
      val work = WorkManager.getInstance(context)
      if (endMs == null || endMs <= nowMs) {
        work.cancelUniqueWork(NAME)
        return
      }
      val request = OneTimeWorkRequestBuilder<BayaanNowTrackEndWorker>()
        .setInitialDelay(endMs - nowMs + 1_000, TimeUnit.MILLISECONDS)
        .build()
      work.enqueueUniqueWork(NAME, ExistingWorkPolicy.REPLACE, request)
    }
  }
}
