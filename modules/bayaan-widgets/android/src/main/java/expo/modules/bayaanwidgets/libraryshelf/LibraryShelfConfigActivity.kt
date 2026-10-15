// libraryshelf/LibraryShelfConfigActivity.kt
package expo.modules.bayaanwidgets.libraryshelf

import android.app.Activity
import android.os.Bundle
import expo.modules.bayaanwidgets.ContentConfigJson
import expo.modules.bayaanwidgets.ContentLogic
import expo.modules.bayaanwidgets.ContentModels
import expo.modules.bayaanwidgets.LibraryShelfConfig
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.ui.ConfigPicker

/** Picks Downloads or a playlist from content.json. */
class LibraryShelfConfigActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val appWidgetId = ConfigPicker.begin(this) ?: return
    val playlists = WidgetStorage.readContentJson(this)?.let { ContentModels.decodeContent(it) }?.playlists.orEmpty()
    ConfigPicker.pick(this, "Library", listOf("Downloads") + playlists.map { it.name },
      onPick = { i ->
        val source = if (i == 0) ContentLogic.DOWNLOADS else ContentLogic.PLAYLIST_PREFIX + playlists[i - 1].id
        ConfigPicker.save(this, appWidgetId, ContentConfigJson.encode(LibraryShelfConfig(source)), LibraryShelfWidget())
      },
      onCancel = { finish() })
  }
}
