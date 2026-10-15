// libraryshelf/LibraryShelfReceiver.kt
package expo.modules.bayaanwidgets.libraryshelf

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import expo.modules.bayaanwidgets.WidgetStorage

class LibraryShelfReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = LibraryShelfWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    WidgetStorage.deleteConfigs(context, appWidgetIds)
  }
}
