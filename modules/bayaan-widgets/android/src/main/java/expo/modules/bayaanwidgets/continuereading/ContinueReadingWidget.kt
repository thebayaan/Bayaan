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
import expo.modules.bayaanwidgets.ui.Eyebrow
import expo.modules.bayaanwidgets.ui.ReadingColors
import expo.modules.bayaanwidgets.ui.isNightMode
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.layout.Box
import androidx.glance.layout.fillMaxSize
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

  // @ai-start
  @Composable
  private fun Content(context: Context, lastRead: WidgetLastRead?) {
    val size = LocalSize.current
    val page = lastRead?.page ?: 1
    val surah = StaticData.surah(context, lastRead?.surahId ?: 1)
    val surahName = lastRead?.surahName ?: surah?.name ?: "Al-Fatihah"
    val progress = (page.toFloat() / MUSHAF_PAGES).coerceIn(0f, 1f)
    val root = GlanceModifier.fillMaxSize().background(ReadingColors.BACKGROUND).cornerRadius(20.dp)
      .clickable(appLink(context, "mushaf/$page"))
    val eyebrow = if (lastRead == null) "Start reading" else "Continue reading"
    val short = WidgetSizes.isShort(size)
    if (size.width >= WidgetSizes.MEDIUM.width) {
      Row(root.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        PageGlimpse(context, lastRead, surahName, GlanceModifier.width(if (short) 80.dp else 92.dp).fillMaxHeight())
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
          Eyebrow(eyebrow, ReadingColors.LABEL)
          Text(surahName, maxLines = 1, style = TextStyle(color = ReadingColors.PRIMARY, fontSize = 18.sp, fontWeight = FontWeight.Bold))
          Text(lastRead?.let { "Page ${it.page} · Juz ${it.juz}" } ?: "Page 1", maxLines = 1,
            style = TextStyle(color = ReadingColors.SECONDARY, fontSize = 12.sp))
          Spacer(GlanceModifier.defaultWeight())
          PageProgress(progress)
          // A 110 dp tall cell has no room for the button; the whole widget opens the page.
          if (!short) {
            Spacer(GlanceModifier.height(8.dp))
            Box(
              GlanceModifier.fillMaxWidth().height(30.dp).background(ReadingColors.BUTTON).cornerRadius(15.dp),
              contentAlignment = Alignment.Center,
            ) {
              Text(if (lastRead == null) "Start reading" else "Resume reading", maxLines = 1,
                style = TextStyle(color = ReadingColors.BUTTON_GLYPH, fontSize = 12.sp, fontWeight = FontWeight.Bold))
            }
          }
        }
      }
    } else {
      // Words, not letters: a short label, the page number on its own line, then "page · Juz".
      Column(root.padding(12.dp)) {
        Eyebrow(if (lastRead == null) "Start" else "Last read", ReadingColors.LABEL)
        Spacer(GlanceModifier.defaultWeight())
        Text("$page", maxLines = 1, style = TextStyle(color = ReadingColors.PRIMARY, fontSize = 28.sp, fontWeight = FontWeight.Bold))
        Text(lastRead?.let { "page · Juz ${it.juz}" } ?: "page", maxLines = 1,
          style = TextStyle(color = ReadingColors.SECONDARY, fontSize = 11.sp, fontWeight = FontWeight.Medium))
        Text(surahName, maxLines = 1,
          style = TextStyle(color = ReadingColors.PRIMARY, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        Spacer(GlanceModifier.height(6.dp))
        PageProgress(progress)
      }
    }
  }

  @Composable
  private fun PageProgress(progress: Float) {
    LinearProgressIndicator(
      progress = progress, modifier = GlanceModifier.fillMaxWidth().height(4.dp),
      color = ReadingColors.LABEL, backgroundColor = ReadingColors.RULE,
    )
  }

  /** A framed glimpse of the page: the surah name and its opening words. */
  @Composable
  private fun PageGlimpse(context: Context, lastRead: WidgetLastRead?, surahName: String, modifier: GlanceModifier) {
    val ink = if (isNightMode(context)) 0xFFF4F3EC.toInt() else 0xFF06151C.toInt()
    Column(
      modifier.background(ReadingColors.RULE).cornerRadius(10.dp).padding(1.dp),
    ) {
      Column(
        GlanceModifier.fillMaxSize().background(ReadingColors.BACKGROUND).cornerRadius(9.dp).padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Text(surahName, maxLines = 1, style = TextStyle(color = ReadingColors.LABEL, fontSize = 9.sp, fontWeight = FontWeight.Bold))
        Spacer(GlanceModifier.height(4.dp))
        val opening = lastRead?.openingText.orEmpty()
        if (opening.isNotEmpty()) {
          ArabicText(context, opening, ArabicBitmap.QURAN_FONT, 74f, 64f, 14f, 9f, 4, center = true, color = ink)
        }
      }
    }
  }

  private companion object {
    const val MUSHAF_PAGES = 604
  }
  // @ai-end
}
