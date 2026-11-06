// tasbeeh/TasbeehWidget.kt
package expo.modules.bayaanwidgets.tasbeeh

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import expo.modules.bayaanwidgets.AppBrand
import expo.modules.bayaanwidgets.ArabicBitmap
import expo.modules.bayaanwidgets.CatalogDhikr
import expo.modules.bayaanwidgets.CatalogModels
import expo.modules.bayaanwidgets.DayMath
import expo.modules.bayaanwidgets.GlanceState
import expo.modules.bayaanwidgets.R
import expo.modules.bayaanwidgets.RingBitmap
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.TasbeehLogic
import expo.modules.bayaanwidgets.WidgetConfigJson
import expo.modules.bayaanwidgets.WidgetInputs
import expo.modules.bayaanwidgets.ui.ArabicText
import expo.modules.bayaanwidgets.ui.Logo
import expo.modules.bayaanwidgets.ui.WidgetPalette
import androidx.compose.ui.graphics.toArgb
import kotlin.math.roundToInt
import expo.modules.bayaanwidgets.ui.RoundButton
import expo.modules.bayaanwidgets.ui.WidgetColors
import expo.modules.bayaanwidgets.ui.WidgetSizes
import expo.modules.bayaanwidgets.ui.appLink
import expo.modules.bayaanwidgets.ui.dpToPx
import java.util.TimeZone

class TasbeehWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.SMALL, WidgetSizes.MEDIUM))
  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val stored = GlanceState.stored(context, GlanceState.appWidgetId(context, id))
    provideContent {
      val inputs = GlanceState.current(currentState(), stored)
      Content(context, inputs)
    }
  }

  @Composable
  private fun Content(context: Context, inputs: WidgetInputs) {
    val root = GlanceModifier.fillMaxSize().background(WidgetColors.BACKGROUND).cornerRadius(20.dp)
    val catalog = remember(inputs.catalogJson) { inputs.catalogJson?.let { CatalogModels.decode(it) } }
    val config = WidgetConfigJson.decodeTasbeeh(inputs.configJson)
    val dhikr = catalog?.dhikr(config.dhikrId) ?: catalog?.dhikr(WidgetConfigJson.DEFAULT_DHIKR_ID)
    if (dhikr == null) {
      Column(root.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalAlignment = Alignment.CenterVertically) {
        Logo(20)
        Spacer(GlanceModifier.height(6.dp))
        Text("Open ${AppBrand.name(context)} to set up Tasbeeh", style = TextStyle(color = WidgetColors.WHITE, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center))
      }
      return
    }
    val snapshot = remember(inputs.snapshotJson) { inputs.snapshotJson?.let { SnapshotModels.decode(it) } }
    val count = TasbeehLogic.displayCount(
      snapshot?.tasbeeh?.get(dhikr.id), TasbeehLogic.parse(inputs.pendingTasbeehJson), dhikr.id,
      DayMath.localDayKey(System.currentTimeMillis(), TimeZone.getDefault()),
    )
    // @ai-start
    val increment = actionRunCallback<IncrementTasbeehAction>(actionParametersOf(TasbeehActions.DHIKR_ID to dhikr.id))
    val size = LocalSize.current
    if (size.width >= WidgetSizes.MEDIUM.width) {
      val reset = actionRunCallback<ResetTasbeehAction>(actionParametersOf(TasbeehActions.DHIKR_ID to dhikr.id))
      val ring = minOf(120, size.height.value.toInt() - 28)
      Row(root.padding(14.dp).clickable(appLink(context, "adhkar")), verticalAlignment = Alignment.CenterVertically) {
        Box(GlanceModifier.clickable(increment)) { Beads(context, count, dhikr.repeatCount, ring, arabic = null) }
        Spacer(GlanceModifier.width(14.dp))
        Column(GlanceModifier.defaultWeight().fillMaxHeight(), horizontalAlignment = Alignment.End) {
          // A 110 dp tall cell keeps the dhikr and reset only.
          val short = WidgetSizes.isShort(size)
          ArabicText(context, dhikr.arabic, ArabicBitmap.DHIKR_FONT, size.width.value - 28 - 14 - ring, 44f, 24f, 12f, 2, center = false)
          if (!short) Translation(dhikr)
          Spacer(GlanceModifier.defaultWeight())
          Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (!short) {
              Text("Tap the beads to count", maxLines = 2, modifier = GlanceModifier.defaultWeight(),
                style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            } else {
              Spacer(GlanceModifier.defaultWeight())
            }
            RoundButton(R.drawable.widget_reset, "Reset", reset)
          }
        }
      }
      return
    }
    // The whole small widget counts.
    Box(root.padding(10.dp).clickable(increment), contentAlignment = Alignment.Center) {
      Beads(context, count, dhikr.repeatCount, minOf(size.width.value, size.height.value).toInt() - 20, dhikr.arabic)
    }
  }

  @Composable
  private fun Translation(dhikr: CatalogDhikr) {
    val translation = dhikr.translation ?: return
    Text(translation, maxLines = 2, style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 12.sp, textAlign = TextAlign.End))
  }

  /** 33 beads around the count; the filled share follows the target. */
  @Composable
  private fun Beads(context: Context, count: Int, target: Int, sizeDp: Int, arabic: String?) {
    val px = dpToPx(context, sizeDp)
    val filled = (TasbeehLogic.progress(count, target) * BEADS).roundToInt()
    val bmp = remember(filled, px) {
      RingBitmap.beads(px, BEADS, filled, WidgetPalette.ACCENT.toArgb(), 0x33FFFFFF)
    }
    Box(GlanceModifier.size(sizeDp.dp), contentAlignment = Alignment.Center) {
      Image(ImageProvider(bmp), contentDescription = "Count, $count of $target", modifier = GlanceModifier.fillMaxSize())
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (arabic != null) ArabicText(context, arabic, ArabicBitmap.DHIKR_FONT, sizeDp * 0.62f, 22f, 15f, 10f, 1, center = true)
        Text("$count", style = TextStyle(color = WidgetColors.WHITE, fontSize = (sizeDp * 0.24f).sp, fontWeight = FontWeight.Bold))
        Text("of $target", style = TextStyle(color = WidgetColors.SECONDARY, fontSize = 11.sp, fontWeight = FontWeight.Medium))
      }
    }
  }

  private companion object {
    const val BEADS = 33
  }
  // @ai-end
}
