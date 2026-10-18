// ayahoftheday/AyahOfTheDayWidget.kt
package expo.modules.bayaanwidgets.ayahoftheday

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.StaticAyah
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetText
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.commandAction
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.playTrackCommand
import java.util.TimeZone

class AyahOfTheDayWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, SMALL_TALL, WidgetSizes.MEDIUM, MEDIUM_TALL, WidgetSizes.LARGE))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      // Read state so a midnight push recomposes; the ayah itself depends only on today's date.
      GlanceState.current(currentState(), stored)
      Content(context, StaticData.ayahOfTheDay(context, System.currentTimeMillis(), TimeZone.getDefault()))
    }
  }

  @Composable
  private fun Content(context: Context, ayah: StaticAyah?) {
    val size = LocalSize.current
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    if (ayah == null) {
      Box(root, contentAlignment = Alignment.Center) {
        Text("Open ${AppBrand.name(context)}", style = TextStyle(color = WidgetColors.WHITE, fontWeight = FontWeight.Medium))
      }
      return
    }
    val open = appLink(context, "quran/${ayah.surahId}?ayah=${ayah.ayah}")
    val listen = commandAction(context, playTrackCommand(ayah.surahId, null, null, ayah.ayah), "ayah/${ayah.key}")
    val width = size.width.value
    when {
      size.height >= WidgetSizes.LARGE.height -> Column(root.padding(16.dp).clickable(open)) {
        Header(ayah, listen)
        Spacer(GlanceModifier.defaultWeight())
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 32, 130f, 32f, 14f, 6, center = true)
        Spacer(GlanceModifier.height(12.dp))
        Text(ayah.translation, maxLines = 5, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 14.sp))
        Spacer(GlanceModifier.defaultWeight())
      }
      size.width >= WidgetSizes.MEDIUM.width -> Column(root.padding(14.dp).clickable(open)) {
        Header(ayah, listen)
        Spacer(GlanceModifier.height(6.dp))
        // A 2-row widget is often taller than the 110 dp bucket; the TALL buckets give the ayah that room.
        val arabicHeight = maxOf(44f, size.height.value - MEDIUM_CHROME_DP)
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 28, arabicHeight, 24f, 12f, 3, center = true)
        Spacer(GlanceModifier.height(4.dp))
        Text(ayah.translation, maxLines = 2, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp))
      }
      else -> Column(root.padding(12.dp).clickable(open), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(GlanceModifier.fillMaxWidth()) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(12)
        }
        Spacer(GlanceModifier.defaultWeight())
        ArabicText(context, ayah.arabic, ArabicBitmap.QURAN_FONT, width - 24, size.height.value - 24 - 20, 26f, 10f, 6, center = true)
        Spacer(GlanceModifier.defaultWeight())
      }
    }
  }

  @Composable
  private fun Header(ayah: StaticAyah, listen: Action) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      RoundButton(android.R.drawable.ic_media_play, "Listen", listen)
      Spacer(GlanceModifier.width(8.dp))
      Text(WidgetText.reference(ayah.surahName, ayah.key), maxLines = 1,
        style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 12.sp, fontWeight = FontWeight.Bold))
      Spacer(GlanceModifier.defaultWeight())
      Logo(14)
    }
  }

  private companion object {
    val SMALL_TALL = DpSize(110.dp, 180.dp)
    val MEDIUM_TALL = DpSize(250.dp, 180.dp)
    /** Padding, header, spacers and a two-line translation around the medium ayah. */
    const val MEDIUM_CHROME_DP = 104f
  }
}
