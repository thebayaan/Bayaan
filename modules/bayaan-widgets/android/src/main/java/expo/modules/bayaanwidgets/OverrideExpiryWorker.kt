package expo.modules.bayaanwidgets

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import java.util.concurrent.TimeUnit

/** Re-renders the widget once a playback override has expired or the playing track has ended. */
class OverrideExpiryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    runCatching { ContinueListeningWidget.pushState(applicationContext) }
    return Result.success()
  }

  companion object {
    private const val NAME = "bayaan-widgets-override-expiry"
    private const val TRACK_END_NAME = "bayaan-widgets-track-end"

    /** Replaces any pending run, so only the latest tap's expiry fires. */
    fun schedule(context: Context) {
      val request = OneTimeWorkRequestBuilder<OverrideExpiryWorker>()
        .setInitialDelay(PlaybackState.OVERRIDE_TTL_MS + 1_000, TimeUnit.MILLISECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(NAME, ExistingWorkPolicy.REPLACE, request)
    }

    /**
     * Re-renders just after the computed track end, so the countdown stops at
     * zero even when the app is gone and no snapshot arrives.
     */
    fun scheduleTrackEnd(context: Context, delayMs: Long) {
      val request = OneTimeWorkRequestBuilder<OverrideExpiryWorker>()
        .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(TRACK_END_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun cancelTrackEnd(context: Context) {
      WorkManager.getInstance(context).cancelUniqueWork(TRACK_END_NAME)
    }
  }
}
