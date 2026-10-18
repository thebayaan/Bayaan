package expo.modules.bayaancar

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CarSearchTest {
  private val art = CarArtwork.Color("", "#333333")
  private val snapshot = CarSnapshot(
    topReciterId = "alafasy",
    sections = emptyList(),
    library = emptyList(),
    lists = emptyMap(),
    reciters = listOf(
      CarReciter("alafasy", "Mishary Alafasy", art, true, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 18)))),
      CarReciter("sudais", "Abdul Rahman Al-Sudais", art, false, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 18)))),
    ),
    surahs = listOf(
      CarSurah(1, "Al-Fatihah", "الفاتحة", "The Opening", 7),
      CarSurah(18, "Al-Kahf", "الكهف", "The Cave", 110),
    ),
    juz = emptyList(),
    downloadedKeys = emptySet(),
  )

  private fun ids(matches: List<CarVoiceMatch>): List<Pair<String, Int>> =
    matches.map { JSONObject(it.request).let { o -> o.getString("reciterId") to o.getInt("surahId") } }

  @Test fun surahWithReciter() {
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "al kahf by mishary")))
  }

  @Test fun prefixAndSurahWordAreIgnored() {
    assertEquals(listOf("alafasy" to 18, "sudais" to 18).take(1), ids(CarSearch.search(snapshot, "Surah Kahf")).take(1))
    assertEquals(ids(CarSearch.search(snapshot, "kahf")), ids(CarSearch.search(snapshot, "Al-Kahf")))
  }

  @Test fun noReciterUsesTopThenFavorites() {
    assertEquals(listOf("alafasy" to 1), ids(CarSearch.search(snapshot, "fatiha")))
  }

  @Test fun surahNumberAndArabicMatch() {
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "18")))
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "الكهف")))
  }

  @Test fun unknownOrEmptyYieldsNothing() {
    assertTrue(CarSearch.search(snapshot, "nonexistent").isEmpty())
    assertTrue(CarSearch.search(snapshot, "kahf by nobody").isEmpty())
    assertTrue(CarSearch.search(snapshot, "").isEmpty())
    assertTrue(CarSearch.search(null, "kahf").isEmpty())
  }

  @Test fun requestsMatchTheJsContract() {
    val o = JSONObject(CarSearch.search(snapshot, "kahf").first().request)
    assertEquals("surah", o.getString("kind"))
    assertEquals("hafs", o.getString("rewayatId"))
    assertEquals(18, o.getInt("surahId"))
  }

  private fun play(json: String) = CarItemAction.Play(json)
  private val rich = snapshot.copy(
    surahs = snapshot.surahs + CarSurah(36, "Ya-Sin", "يس", "Ya Sin", 83) + CarSurah(2, "Al-Baqarah", "البقرة", "The Cow", 286),
    reciters = listOf(
      CarReciter("alafasy", "Mishary Alafasy", art, true, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 2, 18, 36)))),
      CarReciter("sudais", "Abdul Rahman Al-Sudais", art, false, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 2, 18, 36)))),
    ),
    lists = mapOf(
      "loved" to CarList("loved", "Loved", listOf(CarItem("l1", "Al-Kahf", null, art, null, false, play("{\"kind\":\"loved\",\"startIndex\":0}")))),
      "uploads" to CarList("uploads", "Uploads", listOf(CarItem("u1", "Hud", null, art, null, false, play("{\"kind\":\"uploads\",\"startIndex\":0}")))),
      "system:evening-serenity" to CarList(
        "system:evening-serenity", "Evening Serenity",
        listOf(CarItem("e1", "Al-Mulk", null, art, null, false, play("{\"kind\":\"playlist\",\"playlistId\":\"evening-serenity\",\"system\":true,\"startIndex\":0}"))),
      ),
    ),
    sections = listOf(
      CarSection("jump-back-in", "Jump back in", "rows", listOf(
        CarItem("r1", "Al-Baqarah", "Abdul Rahman Al-Sudais", CarArtwork.Surah(2), 0.4, false,
          play("{\"kind\":\"surah\",\"reciterId\":\"sudais\",\"rewayatId\":\"hafs\",\"surahId\":2,\"startAt\":90}")),
      )),
    ),
  )

  private fun first(query: String, shuffle: Boolean = false): JSONObject =
    JSONObject(CarSearch.search(rich, query, shuffle).first().request)

  @Test fun spellingVariantsAndTranslations() {
    assertEquals(36, first("Yaseen").getInt("surahId"))
    assertEquals(2, first("surah baqara").getInt("surahId"))
    assertEquals(18, first("the cave").getInt("surahId"))
    assertEquals(18, first("surat al kahaf").getInt("surahId"))
  }

  @Test fun listsByTitleAndAlias() {
    assertEquals("evening-serenity", first("evening serenity").getString("playlistId"))
    assertEquals("loved", first("favorites").getString("kind"))
    assertEquals(true, first("my loved", shuffle = true).getBoolean("shuffle"))
    assertEquals("uploads", first("my recitations").getString("kind"))
  }

  @Test fun reciterAloneResumesTheirLatestOrStartsTheirFirstSurah() {
    val sudais = first("Sudais")
    assertEquals("sudais", sudais.getString("reciterId"))
    assertEquals(2, sudais.getInt("surahId"))
    assertEquals(90, sudais.getInt("startAt"))
    assertEquals(1, first("Mishary").getInt("surahId"))
  }

  @Test fun blankQueryResumesAndNonsenseFindsNothing() {
    assertEquals("resume", first("").getString("kind"))
    assertTrue(CarSearch.search(rich, "pizza").isEmpty())
  }

  @Test fun matchesCarryTitleSubtitleAndArtwork() {
    val match = CarSearch.search(rich, "kahf by sudais").first()
    assertEquals("Al-Kahf", match.title)
    assertEquals("Abdul Rahman Al-Sudais", match.subtitle)
    assertEquals(CarArtwork.Surah(18), match.artwork)
  }
}
