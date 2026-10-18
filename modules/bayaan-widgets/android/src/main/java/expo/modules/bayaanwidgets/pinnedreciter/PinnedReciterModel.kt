package expo.modules.bayaanwidgets.pinnedreciter

import expo.modules.bayaanwidgets.PinnedReciterConfig
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetSnapshot

data class PinnedRow(val surahId: Int, val rewayatId: String?)

sealed interface PinnedReciterState {
  data class Ready(val id: String, val name: String, val artworkFile: String?, val rows: List<PinnedRow>) : PinnedReciterState
  /** Configured reciter is no longer in the catalog. */
  object Unavailable : PinnedReciterState
  /** Nothing configured and no default reciter yet. */
  object Unset : PinnedReciterState
}

/** Mirrors PinnedReciterResolver in WidgetLogic.swift. */
object PinnedReciterModel {
  /** Al-Fatihah, Ya-Sin, Al-Mulk. */
  val POPULAR_SURAHS = listOf(1, 36, 67)

  fun resolve(config: PinnedReciterConfig, catalog: WidgetCatalog?, snapshot: WidgetSnapshot?): PinnedReciterState {
    val configured = config.reciterId
    val (id, name, file) = if (configured != null) {
      val r = catalog?.reciter(configured) ?: return PinnedReciterState.Unavailable
      Triple(r.id, r.name, r.artworkFile)
    } else {
      val d = snapshot?.defaultReciter ?: return PinnedReciterState.Unset
      Triple(d.id, d.name, catalog?.reciter(d.id)?.artworkFile ?: d.artworkFile)
    }
    val recents = snapshot?.reciterRecents?.get(id).orEmpty()
      .filter { it.surahId in 1..114 }.take(3).map { PinnedRow(it.surahId, it.rewayatId) }
    return PinnedReciterState.Ready(id, name, file, recents.ifEmpty { POPULAR_SURAHS.map { PinnedRow(it, null) } })
  }
}
