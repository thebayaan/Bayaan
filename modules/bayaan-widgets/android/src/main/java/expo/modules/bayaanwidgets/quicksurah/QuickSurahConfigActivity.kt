// quicksurah/QuickSurahConfigActivity.kt
package expo.modules.bayaanwidgets.quicksurah

import android.app.Activity
import android.os.Bundle
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.QuickSurahConfig
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks four surahs and an optional reciter. Opened at placement and from "Reconfigure". */
class QuickSurahConfigActivity : Activity() {
  private var appWidgetId = 0
  private lateinit var config: QuickSurahConfig
  private var catalog: WidgetCatalog? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = ConfigPicker.begin(this) ?: return
    config = WidgetConfigJson.decodeQuickSurah(WidgetStorage.readConfigJson(this, appWidgetId))
    catalog = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }
    showMenu()
  }

  private fun surahLabel(id: Int): String = StaticData.surah(this, id)?.let { "${it.id}. ${it.name}" } ?: "$id"

  private fun reciterLabel(): String = catalog?.reciter(config.reciterId)?.name ?: "Default reciter"

  private fun showMenu() {
    val rows = config.surahIds.mapIndexed { i, id -> "Surah ${i + 1}: ${surahLabel(id)}" } + "Reciter: ${reciterLabel()}"
    ConfigPicker.menu(this, "Quick Surah", rows,
      onPick = { index -> if (index < config.surahIds.size) pickSurah(index) else pickReciter() },
      onDone = { save() },
      onCancel = { finish() })
  }

  private fun pickSurah(slot: Int) {
    val surahs = StaticData.surahs(this)
    ConfigPicker.pick(this, "Surah ${slot + 1}", surahs.map { "${it.id}. ${it.name}" },
      onPick = { i ->
        config = config.copy(surahIds = config.surahIds.toMutableList().also { it[slot] = surahs[i].id })
        showMenu()
      },
      onCancel = { showMenu() })
  }

  private fun pickReciter() {
    val reciters = catalog?.reciters.orEmpty()
    ConfigPicker.pick(this, "Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i ->
        config = config.copy(reciterId = if (i == 0) null else reciters[i - 1].id)
        showMenu()
      },
      onCancel = { showMenu() })
  }

  private fun save() {
    ConfigPicker.save(this, appWidgetId, WidgetConfigJson.encode(config), QuickSurahWidget())
  }
}
