// test/java/expo/modules/bayaanwidgets/ContentLogicTest.kt
package expo.modules.bayaanwidgets

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.chrono.HijrahDate
import java.time.temporal.ChronoField
import java.util.TimeZone

class ContentLogicTest {
  private fun fixture(name: String) = File("../src/__fixtures__/$name").readText()
  private fun asset(name: String) = File("src/main/assets/widgets/$name").readText()

  // java.time's Hijrah calendar is Umm al-Qura. Devices use android.icu (IcuHijri), which the JVM lacks.
  private val javaHijri = HijriOf { day ->
    val h = HijrahDate.from(LocalDate.ofEpochDay(day))
    HijriDate(h.get(ChronoField.YEAR), h.get(ChronoField.MONTH_OF_YEAR), h.get(ChronoField.DAY_OF_MONTH))
  }

  private val table = JSONObject(fixture("hijri.table.json"))
  private val from = table.getLong("from")
  private val rows = table.getJSONArray("rows")
  private val tableHijri = HijriOf { day ->
    val i = (day - from).toInt()
    if (i < 0 || i >= rows.length()) null else rows.getJSONArray(i).let { HijriDate(it.getInt(0), it.getInt(1), it.getInt(2)) }
  }

  private val content = ContentModels.decodeContent(fixture("content.full.json"))!!

  @Test fun decodesContentAndRejectsFutureVersion() {
    assertEquals(2, content.downloads.size)
    assertEquals(12, content.downloadCount)
    assertEquals(listOf("item_1", "item_2"), content.playlist("playlist_1")!!.items.map { it.itemId })
    assertNull(content.playlist("playlist_1")!!.items[0].rewayatId)
    assertEquals(listOf(1, 18, 36), content.spotlight[0].surahIds)
    assertEquals(1_791_462_600_000L, content.sleepTimerEndsAt)
    assertNull(ContentModels.decodeContent(fixture("content.full.json").replace("\"version\": 1", "\"version\": 2")))
    assertNull(ContentModels.decodeContent("nope"))
    assertNull(ContentModels.decodeContent(fixture("content.full.json").replace("\"sleepTimerEndsAt\": 1791462600000", "\"sleepTimerEndsAt\": null"))!!.sleepTimerEndsAt)
  }

  @Test fun parsesGeneratedStaticData() {
    val adhkar = ContentModels.decodeAdhkarPeriods(asset("adhkar-periods.json"))!!
    assertEquals(24, adhkar.morning.count)
    assertEquals("evening-adhkar", adhkar.of(AdhkarPeriod.EVENING).superId)
    assertTrue(adhkar.evening.featured.any { it.id == "97" } && adhkar.morning.featured.none { it.id == "97" })
    val occasions = ContentModels.decodeOccasions(asset("occasions.json"))!!
    assertEquals(12, occasions.months.size)
    assertEquals(listOf("eidFitr", "arafah", "eidAdha", "lastTen", "ramadan", "dhulHijjah", "ashura", "jumuah"), occasions.occasions.map { it.id })
    assertEquals(18, occasions.occasion("jumuah")!!.listenSurahId)
    assertTrue(occasions.occasions.all { o -> o.ayat.isNotEmpty() && o.ayat.all { it.arabic.isNotEmpty() && it.translation.isNotEmpty() } })
  }

  @Test fun javaUmmAlQuraMatchesTheTable() {
    for (i in 0 until rows.length()) assertEquals("day ${from + i}", tableHijri.at(from + i), javaHijri.at(from + i))
    assertEquals(HijriDate(1447, 9, 1), tableHijri.at(20502))
  }

  @Test fun ruleVectors() {
    val v = JSONObject(fixture("context.vectors.json"))
    v.getJSONArray("adhkarPeriod").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        assertEquals("$p", p.getString(1), ContentLogic.adhkarPeriod(p.getInt(0)).name.lowercase())
      }
    }
    v.getJSONArray("occasion").let { a ->
      for (i in 0 until a.length()) {
        val c = a.getJSONObject(i)
        val h = if (c.isNull("hijri")) null else c.getJSONArray("hijri").let { HijriDate(it.getInt(0), it.getInt(1), it.getInt(2)) }
        val expect = if (c.isNull("expect")) null else c.getString("expect")
        assertEquals("$c", expect, ContentLogic.occasion(h, c.getInt("weekday"), c.getInt("hour")))
      }
    }
    v.getJSONArray("mode").let { a ->
      for (i in 0 until a.length()) {
        val c = a.getJSONObject(i)
        val occasion = if (c.isNull("occasion")) null else c.getString("occasion")
        assertEquals("$c", c.getString("expect"), ContentLogic.mode(c.getInt("hour"), c.getBoolean("playing"), occasion).wire)
      }
    }
    v.getJSONArray("nextBoundary").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        assertEquals("$p", p.getInt(1), ContentLogic.nextBoundaryMinutes(p.getDouble(0)))
      }
    }
    v.getJSONArray("sleepActive").let { a ->
      for (i in 0 until a.length()) {
        val p = a.getJSONArray(i)
        val endsAt = if (p.isNull(0)) null else p.getLong(0)
        assertEquals("$p", p.getBoolean(2), ContentLogic.sleepActive(endsAt, p.getLong(1)))
      }
    }
  }

  @Test fun nextOccasionVectors() {
    val nv = JSONObject(fixture("next-occasions.vectors.json"))
    val count = nv.getInt("count")
    val cases = nv.getJSONArray("cases")
    for (i in 0 until cases.length()) {
      val c = cases.getJSONObject(i)
      val today = c.getLong("today")
      val e = c.getJSONArray("expect")
      val expect = (0 until e.length()).map { e.getJSONObject(it).let { o -> UpcomingOccasion(o.getString("id"), o.getInt("days")) } }
      assertEquals("table $today", expect, ContentLogic.nextOccasions(today, count, tableHijri))
      assertEquals("java $today", expect, ContentLogic.nextOccasions(today, count, javaHijri))
    }
  }

  @Test fun timeZones() {
    // 2026-02-19T03:30Z: 22:30 Wednesday 18 Feb in New York (1 Ramadan 1447), 12:30 Thursday 19 Feb in Tokyo.
    val now = 1_771_471_800_000L
    val ny = TimeZone.getTimeZone("America/New_York")
    val tokyo = TimeZone.getTimeZone("Asia/Tokyo")
    assertEquals(HijriDate(1447, 9, 1), ContentLogic.hijri(now, ny, tableHijri))
    assertEquals(tableHijri.at(20503), ContentLogic.hijri(now, tokyo, tableHijri))
    assertEquals(22, ContentLogic.hour(now, ny))
    assertEquals(4, ContentLogic.weekday(now, ny))
    assertEquals(12, ContentLogic.hour(now, tokyo))
    assertEquals(5, ContentLogic.weekday(now, tokyo))
    assertEquals("ramadan", ContentLogic.occasionAt(now, ny, tableHijri))
    assertEquals(1_771_477_200_000L, ContentLogic.nextBoundaryMs(now, ny)) // 00:00 Thursday in New York
  }

  @Test fun resolvers() {
    val full = SnapshotModels.decode(fixture("snapshot.full.json"))!!
    val upload = WidgetTrack(0, "Talk", "me", "Me", null, null, true)
    val kahf = full.nowPlaying!!.track
    val shelf = ContentLogic.recentShelf(full.copy(nowPlaying = null, recent = listOf(upload, kahf)))
    assertEquals(listOf(kahf), shelf.tracks)
    assertFalse(shelf.isSuggestion)
    val suggestion = ContentLogic.recentShelf(full.copy(recent = listOf(upload)), 4)
    assertTrue(suggestion.isSuggestion)
    assertEquals(listOf(1, 18, 36, 67), suggestion.tracks.map { it.surahId })
    assertTrue(suggestion.tracks.all { it.reciterId == "r-alafasi" })
    assertTrue(ContentLogic.recentShelf(full.copy(recent = emptyList(), defaultReciter = null)).tracks.isEmpty())
    assertTrue(ContentLogic.recentShelf(null).tracks.isEmpty())

    assertEquals(LibraryShelfState.Downloads(content.downloads, 12), ContentLogic.library(null, content))
    assertEquals(LibraryShelfState.Downloads(content.downloads, 12), ContentLogic.library("downloads", content))
    assertEquals(LibraryShelfState.Playlist(content.playlist("playlist_1")!!), ContentLogic.library("playlist:playlist_1", content))
    assertEquals(LibraryShelfState.Playlist(content.playlist("playlist_2")!!), ContentLogic.library("playlist:playlist_2", content))
    assertEquals(LibraryShelfState.PlaylistUnavailable, ContentLogic.library("playlist:gone", content))
    assertEquals(LibraryShelfState.NoContent, ContentLogic.library("playlist:playlist_1", null))

    val utc = TimeZone.getTimeZone("UTC")
    assertEquals("r-balilah", ContentLogic.spotlight(content, 20737L * 86_400_000L + 3_600_000L, utc)!!.id) // odd day: second entry
    assertNull(ContentLogic.spotlight(null, 0L, utc))
  }

  @Test fun configsDefaultAndSanitize() {
    assertEquals(ContentConfigJson.DEFAULT_BEDTIME, ContentConfigJson.decodeBedtime(null))
    assertEquals(
      BedtimeConfig(67, "r1", 30, null),
      ContentConfigJson.decodeBedtime("""{"surahId":200,"reciterId":"r1","minutes":7,"ambient":"waves"}"""),
    )
    val custom = BedtimeConfig(36, null, 45, "rain")
    assertEquals(custom, ContentConfigJson.decodeBedtime(ContentConfigJson.encode(custom)))
    assertEquals("downloads", ContentConfigJson.decodeLibraryShelf(null).sourceId)
    assertEquals("playlist:p1", ContentConfigJson.decodeLibraryShelf(ContentConfigJson.encode(LibraryShelfConfig("playlist:p1"))).sourceId)
    assertEquals("Off", ContentConfigJson.ambientLabel(null))
    assertEquals("Fireplace", ContentConfigJson.ambientLabel("fireplace"))
  }

  @Test fun textHelpers() {
    val months = ContentModels.decodeOccasions(asset("occasions.json"))!!.months
    assertEquals("29 Rabi al-Thani 1448", ContentLogic.hijriLine(HijriDate(1448, 4, 29), months))
    assertEquals("Tomorrow", ContentLogic.daysLabel(1))
    assertEquals("in 23 days", ContentLogic.daysLabel(23))
    assertEquals("1 surah", ContentLogic.surahCount(1))
    assertEquals("12 surahs", ContentLogic.surahCount(12))
    assertNull(ContentLogic.repeatLabel(1))
    assertEquals("×3", ContentLogic.repeatLabel(3))
  }

  @Test fun playingAtFollowsTheComputedTrackEnd() {
    val full = SnapshotModels.decode(fixture("snapshot.full.json"))!!
    // generatedAt 1791460800000, playing at 120.5 s of 1800 s, rate 1: ends 1679.5 s later.
    assertTrue(ContentLogic.playingAt(full, full.generatedAt + 1_000))
    assertFalse(ContentLogic.playingAt(full, full.generatedAt + 1_680_000))
    assertFalse(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(isPlaying = false)), full.generatedAt))
    assertTrue(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(rate = 2.0)), full.generatedAt + 839_000))
    assertFalse(ContentLogic.playingAt(full.copy(nowPlaying = full.nowPlaying!!.copy(rate = 2.0)), full.generatedAt + 840_000))
    assertFalse(ContentLogic.playingAt(null, 0L))
    assertEquals(full.generatedAt + 1_679_500, ContentLogic.trackEndMs(full))
    assertEquals(full.generatedAt + 839_750, ContentLogic.trackEndMs(full.copy(nowPlaying = full.nowPlaying!!.copy(rate = 2.0))))
    assertNull(ContentLogic.trackEndMs(full.copy(nowPlaying = full.nowPlaying!!.copy(isPlaying = false))))
    assertNull(ContentLogic.trackEndMs(null))
  }

  // RFC-021: same cases as contextRules.test.ts and check-widget-content.sh.
  @Test fun modeWithCardsTurnedOff() {
    assertEquals(BayaanNowMode.LISTENING, ContentLogic.mode(8, false, null, adhkar = false))
    assertEquals(BayaanNowMode.LISTENING, ContentLogic.mode(17, false, null, adhkar = false))
    assertEquals(BayaanNowMode.BEDTIME, ContentLogic.mode(22, false, null, adhkar = false))
    assertEquals(BayaanNowMode.LISTENING, ContentLogic.mode(22, false, null, bedtime = false))
    assertEquals(BayaanNowMode.MORNING_ADHKAR, ContentLogic.mode(8, false, null, bedtime = false))
    assertEquals(BayaanNowMode.OCCASION, ContentLogic.mode(8, false, "jumuah", adhkar = false))
  }
}
