package expo.modules.bayaanwidgets.pinnedreciter

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.PinnedReciterConfig
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks the pinned reciter from the catalog; "Default reciter" clears it. */
class PinnedReciterConfigActivity : Activity() {
  private var appWidgetId = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    appWidgetId = ConfigPicker.begin(this) ?: return
    val reciters = WidgetStorage.readCatalogJson(this)?.let { CatalogModels.decode(it) }?.reciters.orEmpty()
    if (reciters.isEmpty()) {
      // Fresh install: the app has not written the catalog yet. Keep the default reciter.
      Toast.makeText(this, "Open ${AppBrand.name(this)} once to load reciters", Toast.LENGTH_LONG).show()
      save(PinnedReciterConfig(null))
      return
    }
    ConfigPicker.pick(this, "Pinned Reciter", listOf("Default reciter") + reciters.map { it.name },
      onPick = { i -> save(PinnedReciterConfig(if (i == 0) null else reciters[i - 1].id)) },
      onCancel = { finish() })
  }

  private fun save(config: PinnedReciterConfig) {
    ConfigPicker.save(this, appWidgetId, WidgetConfigJson.encode(config), PinnedReciterWidget())
  }
}
