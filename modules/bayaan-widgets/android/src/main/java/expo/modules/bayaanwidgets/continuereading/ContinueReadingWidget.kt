// continuereading/ContinueReadingWidget.kt
package expo.modules.bayaanwidgets.continuereading

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
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
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.StaticData
import expo.modules.bayaanwidgets.WidgetLastRead
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.SurahCard
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.recordMissingArtwork

class ContinueReadingWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    val shown = stored.snapshotJson?.let { SnapshotModels.decode(it) }?.lastRead?.surahId ?: 1
    recordMissingArtwork(context, listOf(shown), emptyList())
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      val lastRead = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) }?.lastRead }
      // A push after new artwork lands must redraw even when lastRead did not change.
      key(inputs.pushedAt) { Content(context, lastRead) }
    }
  }

  @Composable
  private fun Content(context: Context, lastRead: WidgetLastRead?) {
    val size = LocalSize.current
    val page = lastRead?.page ?: 1
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
      .padding(14.dp).clickable(appLink(context, "mushaf/$page"))
    if (size.width >= WidgetSizes.MEDIUM.width) {
      Row(root) {
        PageColumn(context, lastRead, showLogo = false, GlanceModifier.width(110.dp).fillMaxHeight())
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight().fillMaxHeight(), horizontalAlignment = Alignment.End) {
          Logo(14)
          Spacer(GlanceModifier.defaultWeight())
          val opening = lastRead?.openingText.orEmpty()
          if (opening.isNotEmpty()) {
            ArabicText(context, opening, ArabicBitmap.QURAN_FONT, size.width.value - 28 - 14 - 110, 50f, 22f, 12f, 2, center = false)
            Spacer(GlanceModifier.height(4.dp))
          }
          Text(if (lastRead == null) "Start reading" else "Continue reading", maxLines = 1,
            style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        }
      }
    } else {
      PageColumn(context, lastRead, showLogo = true, root)
    }
  }

  @Composable
  private fun PageColumn(context: Context, lastRead: WidgetLastRead?, showLogo: Boolean, modifier: GlanceModifier) {
    val surah = StaticData.surah(context, lastRead?.surahId ?: 1)
    Column(modifier) {
      Row(GlanceModifier.fillMaxWidth()) {
        SurahCard(context, surah, 44)
        if (showLogo) {
          Spacer(GlanceModifier.defaultWeight())
          Logo(14)
        }
      }
      Spacer(GlanceModifier.defaultWeight())
      Text("${lastRead?.page ?: 1}", style = TextStyle(color = WidgetColors.WHITE, fontSize = 30.sp, fontWeight = FontWeight.Bold))
      Text(lastRead?.surahName ?: surah?.name ?: "Al-Fatihah", maxLines = 1,
        style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold))
      Text(lastRead?.let { "Juz ${it.juz}" } ?: "Start reading", maxLines = 1,
        style = TextStyle(color = WidgetColors.TERTIARY, fontSize = 11.sp))
    }
  }
}
