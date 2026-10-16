// tasbeeh/TasbeehConfigActivity.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.TasbeehConfig
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks the dhikr from the catalog. */
class TasbeehConfigActivity : Activity() {
  private var appWidgetId = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = ConfigPicker.begin(this) ?: return
    val adhkar = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }?.adhkar.orEmpty()
    if (adhkar.isEmpty()) {
      Toast.makeText(this, "Open ${AppBrand.name(this)} once to load adhkar", Toast.LENGTH_LONG).show()
      save(TasbeehConfig(WidgetConfigJson.DEFAULT_DHIKR_ID))
      return
    }
    ConfigPicker.pick(this, "Tasbeeh", adhkar.map { "${it.arabic} (${it.repeatCount})" },
      onPick = { i -> save(TasbeehConfig(adhkar[i].id)) },
      onCancel = { finish() })
  }

  private fun save(config: TasbeehConfig) {
    ConfigPicker.save(this, appWidgetId, WidgetConfigJson.encode(config), TasbeehWidget())
  }
}
