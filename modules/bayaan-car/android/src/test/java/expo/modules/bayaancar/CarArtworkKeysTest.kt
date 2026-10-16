package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CarArtworkKeysTest {
  @Test fun surahKeysAcceptOnly1To114() {
    assertEquals(ArtworkKey.Surah(1), CarArtworkKeys.parseKey("surah-1"))
    assertEquals(ArtworkKey.Surah(114), CarArtworkKeys.parseKey("surah-114"))
    assertNull(CarArtworkKeys.parseKey("surah-0"))
    assertNull(CarArtworkKeys.parseKey("surah-115"))
    assertNull(CarArtworkKeys.parseKey("surah-018"))
    assertNull(CarArtworkKeys.parseKey("surah--1"))
    assertNull(CarArtworkKeys.parseKey("surah-1.png"))
  }

  @Test fun payloadKeysRejectTraversalAndEncoding() {
    assertNotNull(CarArtworkKeys.parseKey("url-aHR0cHM6Ly9leGFtcGxlLmNvbQ"))
    assertNotNull(CarArtworkKeys.parseKey("tile-QUJ8I2ZmMA"))
    assertNotNull(CarArtworkKeys.parseKey("asset-a_b-c"))
    listOf("url-../x", "url-a/b", "url-..%2Fx", "url-a.b", "url-", "tile-a b", "other-abc", "-abc", "", "..", "url-a\u0000b")
      .forEach { assertNull(it, CarArtworkKeys.parseKey(it)) }
    assertNull(CarArtworkKeys.parseKey(null))
    assertNull(CarArtworkKeys.parseKey("url-" + "a".repeat(2049)))
  }

  @Test fun iconKeysAllowOnlyTheBundledTiles() {
    assertEquals(ArtworkKey.Icon("loved", null), CarArtworkKeys.parseKey("icon-loved"))
    assertEquals(ArtworkKey.Icon("reciters", null), CarArtworkKeys.parseKey("icon-reciters"))
    assertEquals(ArtworkKey.Icon("uploads", null), CarArtworkKeys.parseKey("icon-uploads"))
    assertEquals(ArtworkKey.Icon("playlist", null), CarArtworkKeys.parseKey("icon-playlist"))
    assertEquals(ArtworkKey.Icon("playlist", "22C55E"), CarArtworkKeys.parseKey("icon-playlist-22C55E"))
    listOf(
      "icon-", "icon-launcher", "icon-loved-22C55E", "icon-playlist-22C55", "icon-playlist-22C55EE",
      "icon-playlist-GGGGGG", "icon-../loved", "icon-car_icon_loved", "icon-Loved",
      "icon-uploads-8B5CF6", "icon-upload", "icon-Uploads",
    ).forEach { assertNull(it, CarArtworkKeys.parseKey(it)) }
  }

  @Test fun iconKeysCarryOnlyAValidPlaylistColour() {
    assertEquals("icon-loved", CarArtworkKeys.iconKey("loved", "#FF0000"))
    assertEquals("icon-uploads", CarArtworkKeys.iconKey("uploads", "#8B5CF6"))
    assertEquals("icon-playlist-22C55E", CarArtworkKeys.iconKey("playlist", "#22c55e"))
    assertEquals("icon-playlist", CarArtworkKeys.iconKey("playlist", "red"))
    assertEquals("icon-playlist", CarArtworkKeys.iconKey("playlist", null))
    assertNull(CarArtworkKeys.iconKey("launcher", null))
    listOf("loved", "playlists", "downloads", "uploads", "reciters", "playlist").forEach { name ->
      assertNotNull(name, CarArtworkKeys.parseKey(CarArtworkKeys.iconKey(name, "#123456")))
    }
  }

  @Test fun fileNameIsHashedAndStable() {
    val name = CarArtworkKeys.fileNameFor("surah-18")
    assertTrue(Regex("[0-9a-f]{64}\\.png").matches(name))
    assertEquals(name, CarArtworkKeys.fileNameFor("surah-18"))
    assertTrue(name != CarArtworkKeys.fileNameFor("surah-19"))
  }

  @Test fun sampleSizeKeepsAtLeastTarget() {
    assertEquals(4, CarArtworkKeys.sampleSize(1200, 1200))
    assertEquals(1, CarArtworkKeys.sampleSize(256, 256))
    assertEquals(1, CarArtworkKeys.sampleSize(300, 300))
    assertEquals(2, CarArtworkKeys.sampleSize(600, 2000))
    assertEquals(1, CarArtworkKeys.sampleSize(0, 0))
  }

  @Test fun centerSquareCrops() {
    assertEquals(Triple(100, 0, 200), CarArtworkKeys.centerSquare(400, 200))
    assertEquals(Triple(0, 50, 100), CarArtworkKeys.centerSquare(100, 200))
    assertEquals(Triple(0, 0, 256), CarArtworkKeys.centerSquare(256, 256))
  }

  @Test fun tileTextHandlesEmptyAndLong() {
    assertEquals("", CarArtworkKeys.tileText(""))
    assertEquals("", CarArtworkKeys.tileText("   "))
    assertEquals("abc", CarArtworkKeys.tileText("abcdef"))
    assertEquals("m", CarArtworkKeys.tileText("m"))
    assertEquals("\u0645\u0634", CarArtworkKeys.tileText("\u0645\u0634"))
    assertEquals("e\u0301ab", CarArtworkKeys.tileText("e\u0301abc"))
  }

  @Test fun evictionRemovesOldestUntilWithinBounds() {
    val files = listOf("a" to (3L to 10L), "b" to (1L to 10L), "c" to (2L to 10L))
    assertEquals(listOf("b"), CarArtworkKeys.evictionOrder(files, maxFiles = 2, maxBytes = 1000))
    assertEquals(listOf("b", "c"), CarArtworkKeys.evictionOrder(files, maxFiles = 10, maxBytes = 10))
    assertEquals(emptyList<String>(), CarArtworkKeys.evictionOrder(files, maxFiles = 3, maxBytes = 30))
  }

  @Test fun httpsOnly() {
    assertTrue(CarArtworkKeys.isHttps("https://a.com/x.png"))
    assertFalse(CarArtworkKeys.isHttps("http://a.com/x.png"))
    assertFalse(CarArtworkKeys.isHttps("https://"))
    assertFalse(CarArtworkKeys.isHttps("file:///etc/passwd"))
  }

  @Test fun allowlistCollectsHttpsArtworkAndNullSnapshotIsEmpty() {
    assertTrue(CarArtworkKeys.allowedUrls(null, null).isEmpty())
    fun item(id: String, a: CarArtwork) = CarItem(id, "t", null, a, null, false, CarItemAction.BrowseList("x"))
    val snap = CarSnapshot(
      topReciterId = null,
      sections = listOf(
        CarSection("s", "S", "grid", listOf(item("1", CarArtwork.Url("https://a.com/1.png")), item("2", CarArtwork.Url("http://insecure.com/2.png")))),
      ),
      library = listOf(item("3", CarArtwork.Asset("https://a.com/3.png")), item("4", CarArtwork.Asset("icon_name"))),
      lists = mapOf("l" to CarList("l", "L", listOf(item("5", CarArtwork.Url("https://a.com/5.png"))))),
      reciters = listOf(CarReciter("r", "R", CarArtwork.Url("https://a.com/r.png"), false, emptyList())),
      surahs = emptyList(),
      juz = emptyList(),
      downloadedKeys = emptySet(),
    )
    assertEquals(
      setOf("https://a.com/1.png", "https://a.com/3.png", "https://a.com/5.png", "https://a.com/r.png"),
      CarArtworkKeys.allowedUrls(snap, null),
    )
  }

  @Test fun arabicIndicDigitsAndBoundaryRejected() {
    assertNull(CarArtworkKeys.parseKey("surah-\u0661\u0668"))
    assertNull(CarArtworkKeys.parseKey("surah-\u0661"))
    assertNotNull(CarArtworkKeys.parseKey("url-" + "a".repeat(2048)))
    assertNull(CarArtworkKeys.parseKey("url-" + "a".repeat(2049)))
  }

  @Test fun tileParsingUsesLastBarAndValidatesHex() {
    assertEquals("a|b" to "#112233", CarArtworkKeys.parseTile("a|b|#112233"))
    assertEquals("" to "#333333", CarArtworkKeys.parseTile("|#333333"))
    assertEquals("ab" to "#333333", CarArtworkKeys.parseTile("ab|notacolor"))
    assertEquals("ab" to "#333333", CarArtworkKeys.parseTile("ab"))
    assertEquals("ab" to "#11223344", CarArtworkKeys.parseTile("ab|#11223344"))
  }

  @Test fun decodableBoundsRejectExtremes() {
    assertTrue(CarArtworkKeys.isDecodable(1200, 1200))
    assertTrue(CarArtworkKeys.isDecodable(400, 100))
    assertFalse(CarArtworkKeys.isDecodable(401, 100))
    assertFalse(CarArtworkKeys.isDecodable(20000, 20000))
    assertFalse(CarArtworkKeys.isDecodable(0, 10))
  }

  @Test fun allowlistIncludesNowPlayingEvenWithoutSnapshot() {
    val np = CarNowPlaying("t", "s", null, 1, true, 0.0, 1.0, 1.0, "off", false, CarArtwork.Url("https://a.com/np.png"), emptyList(), 0, 0L)
    assertEquals(setOf("https://a.com/np.png"), CarArtworkKeys.allowedUrls(null, np))
  }

  @Test fun surahUrlUsesSnapshotBaseOnlyWhenHttps() {
    assertEquals("https://cdn.fork.example/surah/18.png", CarArtworkKeys.surahUrl("https://cdn.fork.example/surah/", 18))
    val fallback = CarArtworkKeys.DEFAULT_SURAH_BASE + "18.png"
    listOf(
      null,
      "",
      "http://cdn.fork.example/surah/",
      "https://cdn.fork.example/surah",
      "https://cdn.fork.example/surah/?x=",
      "https://cdn.fork.example/a b/",
      "https://cdn.fork.example/../x/",
      "file:///data/",
      "https:///",
    ).forEach { assertEquals(it, fallback, CarArtworkKeys.surahUrl(it, 18)) }
  }

  @Test fun snapshotParsesOptionalSurahArtworkBase() {
    val base = """{"version":1,"topReciterId":null,"home":{"sections":[]},"library":[],"lists":{},"reciters":[],"surahs":[],"juz":[],"downloadedKeys":[]"""
    assertNull(CarSnapshot.parse("$base}")!!.surahArtworkBase)
    assertEquals(
      "https://cdn.fork.example/surah/",
      CarSnapshot.parse("$base,\"surahArtworkBase\":\"https://cdn.fork.example/surah/\"}")!!.surahArtworkBase,
    )
  }

  @Test fun snapshotDecodesTheUploadsLibraryEntryAndList() {
    val json = """{"version":1,"topReciterId":null,"home":{"sections":[]},
      "library":[{"id":"lib:uploads","title":"Uploads","artwork":{"kind":"icon","name":"uploads"},
        "action":{"kind":"browse","target":{"kind":"list","listId":"uploads"}}}],
      "lists":{"uploads":{"id":"uploads","title":"Uploads","items":[{"id":"upload:u1","title":"Al-Kahf",
        "subtitle":"Mishary","artwork":{"kind":"surah","surahId":18},
        "action":{"kind":"play","request":{"kind":"uploads","startIndex":0}}}]}},
      "reciters":[],"surahs":[],"juz":[],"downloadedKeys":[]}"""
    val snap = CarSnapshot.parse(json)!!
    val entry = snap.library.single()
    assertEquals(CarArtwork.Icon("uploads", null), entry.artwork)
    assertEquals(CarItemAction.BrowseList("uploads"), entry.action)
    assertEquals("icon-uploads", CarArtworkKeys.iconKey("uploads", null))
    val row = snap.lists.getValue("uploads").items.single()
    val request = org.json.JSONObject((row.action as CarItemAction.Play).requestJson)
    assertEquals("uploads", request.getString("kind"))
    assertEquals(0, request.getInt("startIndex"))
  }
}
