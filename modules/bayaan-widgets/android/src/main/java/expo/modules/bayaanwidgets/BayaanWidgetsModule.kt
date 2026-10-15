package expo.modules.bayaanwidgets

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import expo.modules.bayaanwidgets.adhkar.AdhkarWidget
import expo.modules.bayaanwidgets.bayaannow.BayaanNowWidget
import expo.modules.bayaanwidgets.ayahoftheday.AyahOfTheDayWidget
import expo.modules.bayaanwidgets.ayahoftheday.MidnightReceiver
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import expo.modules.bayaanwidgets.continuereading.ContinueReadingWidget
import expo.modules.bayaanwidgets.bedtime.BedtimeWidget
import expo.modules.bayaanwidgets.hijri.HijriDateWidget
import expo.modules.bayaanwidgets.hijri.OccasionWidget
import expo.modules.bayaanwidgets.libraryshelf.LibraryShelfWidget
import expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterWidget
import expo.modules.bayaanwidgets.quicksurah.QuickSurahWidget
import expo.modules.bayaanwidgets.recentlyplayed.RecentlyPlayedWidget
import expo.modules.bayaanwidgets.spotlight.ReciterSpotlightWidget
import expo.modules.bayaanwidgets.tasbeeh.TasbeehWidget
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanWidgetsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private val commandListener: () -> Unit = { sendEvent("onCommandQueued", emptyMap<String, Any>()) }

  /** Leaves a listener set by a newer module instance in place. */
  private fun clearCommandListener() {
    if (WidgetStorage.onCommandQueued === commandListener) WidgetStorage.onCommandQueued = null
  }

  override fun definition() = ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    OnStartObserving { WidgetStorage.onCommandQueued = commandListener }
    OnStopObserving { clearCommandListener() }
    // A torn-down runtime may skip OnStopObserving; the activity reads a set
    // listener as "JS is alive".
    OnDestroy { clearCommandListener() }

    Function("writeSnapshot") { json: String -> WidgetStorage.writeSnapshot(context, json) }

    Function("reloadWidgets") { kinds: List<String> ->
      for (kind in kinds) {
        when (kind) {
          "ContinueListening" -> updateContinueListening()
          "ContinueReading" -> push(ContinueReadingWidget())
          "QuickSurah" -> push(QuickSurahWidget())
          "PinnedReciter" -> push(PinnedReciterWidget())
          "AyahOfTheDay" -> {
            push(AyahOfTheDayWidget())
            rearmMidnight()
          }
          "Tasbeeh" -> {
            push(TasbeehWidget())
            rearmMidnight()
          }
          "RecentlyPlayed" -> push(RecentlyPlayedWidget())
          "LibraryShelf" -> push(LibraryShelfWidget())
          "Bedtime" -> push(BedtimeWidget())
          "ReciterSpotlight" -> {
            push(ReciterSpotlightWidget())
            rearmContextClock()
          }
          "Adhkar" -> {
            push(AdhkarWidget())
            rearmContextClock()
          }
          "HijriDate" -> {
            push(HijriDateWidget())
            rearmContextClock()
          }
          "Occasion" -> {
            push(OccasionWidget())
            rearmContextClock()
          }
          "BayaanNow" -> {
            push(BayaanNowWidget())
            rearmContextClock()
          }
          else -> Unit // widget kinds register here as they are added
        }
      }
    }

    Function("takeQueuedCommands") { WidgetStorage.takeQueue(context) }
    Function("takePendingTasbeeh") { WidgetStorage.takeTasbeeh(context) }
    Function("writeCatalog") { json: String -> WidgetStorage.writeCatalog(context, json) }
    Function("writeContent") { json: String -> WidgetStorage.writeContent(context, json) }
    Function("readArtworkRequests") { WidgetStorage.readArtworkRequestsJson(context) }

    Function("hasArtwork") { fileName: String ->
      java.io.File(WidgetStorage.artworkDir(context), fileName).exists()
    }

    AsyncFunction("cacheArtwork") { sourceUrl: String, fileName: String ->
      ArtworkStore.cache(context, sourceUrl, fileName)
    }
  }

  private fun updateContinueListening() {
    val ctx = context
    CoroutineScope(Dispatchers.Default).launch {
      runCatching { ContinueListeningWidget.pushState(ctx) }
    }
  }

  /** Any app push re-arms a midnight alarm that was lost (force stop, task killer). */
  private fun rearmMidnight() {
    val ctx = context
    if (MidnightReceiver.hasWidgets(ctx)) MidnightReceiver.schedule(ctx)
  }

  /** Any app push re-arms the context alarm that a force stop cancelled. */
  private fun rearmContextClock() {
    val ctx = context
    if (ContextClockReceiver.hasWidgets(ctx)) ContextClockReceiver.schedule(ctx)
  }

  /** Pushes stored inputs into every instance of a Phase 1b widget. */
  private fun push(widget: GlanceAppWidget) {
    val ctx = context
    CoroutineScope(Dispatchers.Default).launch { runCatching { GlanceState.push(ctx, widget) } }
  }
}
