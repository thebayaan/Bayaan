// bedtime/BedtimeConfigActivity.kt
package expo.modules.bayaanwidgets.bedtime

import android.app.Activity
import android.os.Bundle
import expo.modules.bayaanwidgets.BedtimeConfig
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetCatalog
import expo.modules.bayaanwidgets.WidgetFeatures
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks the surah, reciter, sleep minutes and ambient sound. */
class BedtimeConfigActivity : Activity() {
  private var appWidgetId = 0
  private lateinit var config: BedtimeConfig
  private var catalog: WidgetCatalog? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = ConfigPicker.begin(this) ?: return
    config = ContentConfigJson.decodeBedtime(WidgetStorage.readConfigJson(this, appWidgetId))
    catalog = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }
    showMenu()
  }

  private fun showMenu() {
    val surah = StaticData.surah(this, config.surahId)?.let { "${it.id}. ${it.name}" } ?: "${config.surahId}"
    val reciter = catalog?.reciter(config.reciterId)?.name ?: "Default reciter"
    // The ambient row is last, so dropping it (RFC-021) keeps the indices below.
    val rows = listOf(
      "Surah: $surah", "Reciter: $reciter", "Sleep timer: ${config.minutes} min",
    ) + if (WidgetFeatures.ambient(this)) listOf("Ambient: ${ContentConfigJson.ambientLabel(config.ambient)}") else emptyList()
    ConfigPicker.menu(this, "Bedtime", rows,
      onPick = { index ->
        when (index) {
          0 -> pickSurah()
          1 -> pickReciter()
          2 -> pickMinutes()
          else -> pickAmbient()
        }
      },
      onDone = { ConfigPicker.save(this, appWidgetId, ContentConfigJson.encode(config), BedtimeWidget()) },
      onCancel = { finish() })
  }

  private fun pickSurah() {
    val surahs = StaticData.surahs(this)
    ConfigPicker.pick(this, "Surah", surahs.map { "${it.id}. ${it.name}" },
      onPick = { i -> config = config.copy(surahId = surahs[i].id); showMenu() }, onCancel = { showMenu() })
  }

  private fun pickReciter() {
    val reciters = catalog?.reciters.orEmpty()
    ConfigPicker.pick(this, "Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i -> config = config.copy(reciterId = if (i == 0) null else reciters[i - 1].id); showMenu() },
      onCancel = { showMenu() })
  }

  private fun pickMinutes() {
    val options = ContentConfigJson.BEDTIME_MINUTES
    ConfigPicker.pick(this, "Sleep timer", options.map { "$it minutes" },
      onPick = { i -> config = config.copy(minutes = options[i]); showMenu() }, onCancel = { showMenu() })
  }

  private fun pickAmbient() {
    val options = listOf<String?>(null) + ContentConfigJson.AMBIENT_SOUNDS
    ConfigPicker.pick(this, "Ambient sound", options.map { ContentConfigJson.ambientLabel(it) },
      onPick = { i -> config = config.copy(ambient = options[i]); showMenu() }, onCancel = { showMenu() })
  }
}
