// test/java/expo/modules/bayaanwidgets/WidgetLogicTest.kt
package expo.modules.bayaanwidgets

import expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterModel
import expo.modules.bayaanwidgets.pinnedreciter.PinnedReciterState
import expo.modules.bayaanwidgets.pinnedreciter.PinnedRow
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.TimeZone

class WidgetLogicTest {
  private val ny = TimeZone.getTimeZone("America/New_York")
  private val utc = TimeZone.getTimeZone("UTC")
  private val lateEvening = 1_791_689_400_000L // 2026-10-11T03:30Z, 23:30 on the 10th in New York

  // Same vectors as dayMath.test.ts and check-widget-fixtures.sh.
  @Test fun dayMath() {
    assertEquals(20736L, DayMath.dayNumber(lateEvening, ny))
    assertEquals(20737L, DayMath.dayNumber(lateEvening, utc))
    assertEquals(66, DayMath.ayahIndex(lateEvening, ny, 390))
    assertEquals(282, DayMath.ayahIndex(1_709_208_000_000L, utc, 390))
    assertEquals(389, DayMath.ayahIndex(-43_200_000L, utc, 390))
    assertEquals(-1, DayMath.ayahIndex(lateEvening, ny, 0))
    assertEquals("2026-10-10", DayMath.localDayKey(lateEvening, ny))
    assertEquals(1_791_691_200_000L, DayMath.nextLocalMidnightMs(lateEvening, ny))
  }

  @Test fun tasbeehAppendCoalescesAndDropsOldDays() {
    var list = listOf(PendingTasbeehEntry("a", 9, "d0", false))
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    list = TasbeehLogic.append(list, "a", "d1", reset = true)
    list = TasbeehLogic.append(list, "a", "d1", reset = false)
    assertEquals(
      listOf(
        PendingTasbeehEntry("a", 2, "d1", false),
        PendingTasbeehEntry("a", 0, "d1", true),
        PendingTasbeehEntry("a", 1, "d1", false),
      ),
      list,
    )
    assertEquals(list, TasbeehLogic.parse(TasbeehLogic.encode(list)))
  }

  @Test fun tasbeehProgress() {
    assertEquals(0.5f, TasbeehLogic.progress(50, 100), 0f)
    assertEquals(1f, TasbeehLogic.progress(150, 100), 0f)
    assertEquals(0f, TasbeehLogic.progress(3, 0), 0f)
  }

  @Test fun artworkRequestsMerge() {
    val merged = ArtworkRequestsJson.merge(ArtworkRequests(listOf(36), listOf("r1")), listOf(18, 36, 0, 115), listOf("r1", "", "r2"))
    assertEquals(ArtworkRequests(listOf(18, 36), listOf("r1", "r2")), merged)
    val many = ArtworkRequestsJson.merge(ArtworkRequests(emptyList(), emptyList()), emptyList(), (1..60).map { "r$it" })
    assertEquals(50, many.reciterIds.size)
    assertEquals("r11", many.reciterIds.first())
    assertEquals(merged, ArtworkRequestsJson.decode(ArtworkRequestsJson.encode(merged)))
    assertEquals(ArtworkRequests(emptyList(), emptyList()), ArtworkRequestsJson.decode("garbage"))
  }

  @Test fun quickSurahConfigDefaultsAndSanitizes() {
    assertEquals(QuickSurahConfig(listOf(18, 36, 67, 56), null), WidgetConfigJson.decodeQuickSurah(null))
    assertEquals(
      QuickSurahConfig(listOf(55, 36, 67, 56), "r1"),
      WidgetConfigJson.decodeQuickSurah("""{"surahIds":[55,0],"reciterId":"r1"}"""),
    )
    val c = QuickSurahConfig(listOf(1, 2, 3, 4), null)
    assertEquals(c, WidgetConfigJson.decodeQuickSurah(WidgetConfigJson.encode(c)))
    assertEquals("91", WidgetConfigJson.decodeTasbeeh("nope").dhikrId)
    assertEquals("96", WidgetConfigJson.decodeTasbeeh(WidgetConfigJson.encode(TasbeehConfig("96"))).dhikrId)
    assertNull(WidgetConfigJson.decodePinnedReciter("""{"reciterId":null}""").reciterId)
    assertEquals("r9", WidgetConfigJson.decodePinnedReciter(WidgetConfigJson.encode(PinnedReciterConfig("r9"))).reciterId)
  }

  @Test fun textHelpers() {
    assertEquals("MR", WidgetText.initials("Mishary Rashid Alafasy"))
    assertEquals("", WidgetText.initials("  "))
    assertEquals("Al-Kahf 18:10", WidgetText.reference("Al-Kahf", "18:10"))
  }

  @Test fun textFit() {
    assertEquals(20f, TextFit.largestFitting(30f, 10f, 2f) { it <= 20f }, 0f)
    assertEquals(10f, TextFit.largestFitting(30f, 10f, 2f) { false }, 0f)
    assertEquals(12f, TextFit.largestFitting(12f, 12f, 2f) { true }, 0f)
  }

  private val snapshot = SnapshotModels.decode(File("../src/__fixtures__/snapshot.full.json").readText())!!
  private val catalog = CatalogModels.decode(File("../src/__fixtures__/catalog.json").readText())!!

  @Test fun pinnedReciterResolve() {
    val track = snapshot.upNext.first()
    val withRecents = snapshot.copy(reciterRecents = mapOf("r-alafasi" to listOf(track)))
    assertEquals(
      PinnedReciterState.Ready("r-alafasi", "Mishary Alafasi", "reciter-r-alafasi.jpg", listOf(PinnedRow(36, "rw-1"))),
      PinnedReciterModel.resolve(PinnedReciterConfig("r-alafasi"), catalog, withRecents),
    )
    assertEquals(PinnedReciterState.Unavailable, PinnedReciterModel.resolve(PinnedReciterConfig("gone"), catalog, snapshot))
    assertEquals(
      PinnedReciterState.Ready("r-alafasi", "Mishary Alafasi", "reciter-r-alafasi.jpg", listOf(PinnedRow(1, null), PinnedRow(36, null), PinnedRow(67, null))),
      PinnedReciterModel.resolve(PinnedReciterConfig(null), catalog, snapshot),
    )
    assertEquals(PinnedReciterState.Unset, PinnedReciterModel.resolve(PinnedReciterConfig(null), null, snapshot.copy(defaultReciter = null)))
  }
}
