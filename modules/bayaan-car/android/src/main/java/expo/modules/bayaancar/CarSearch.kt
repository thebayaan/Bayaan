package expo.modules.bayaancar

import java.text.Normalizer
import org.json.JSONObject

/** One thing a voice query can play: the JS play request and how to show it. */
data class CarVoiceMatch(
  val request: String,
  val title: String,
  val subtitle: String?,
  val artwork: CarArtwork,
)

/**
 * Matches a voice query ("al kahf by mishary", "yaseen", "my loved",
 * "evening serenity", "sudais") against the snapshot. Mirrors the iOS
 * CarVoiceSearch (Siri), so both cars understand the same phrases.
 */
object CarSearch {
  private val reciterSeparators = listOf(" recited by ", " read by ", " by ", " with ", " from ")
  private val honorifics = setOf("sheikh", "shaykh", "shaikh", "imam", "qari", "al", "el", "ash", "as", "ad")
  private val surahPrefixes = listOf("surah ", "surat ", "suratul ", "sura ", "soorah ", "the ")
  private val article = Regex("^(al|an|ar|as|at|ad|adh|ash|az|ul)[\\s\\-'’]+")
  private val marks = Regex("\\p{Mn}+")
  private val listAliases = mapOf(
    "loved" to setOf("liked", "likes", "favorites", "favourites", "lovedsurahs", "lovedones", "hearts"),
    "downloads" to setOf("downloaded", "offline", "downloadedsurahs"),
    "uploads" to setOf("recitations", "recordings", "uploaded"),
  )
  private const val MAX_RESULTS = 10

  private fun fold(text: String): String =
    Normalizer.normalize(text, Normalizer.Form.NFD).replace(marks, "").lowercase().trim()

  /** "Surat Al-Kahf" -> "kahf". */
  fun normalize(text: String): String {
    var s = fold(text)
    surahPrefixes.firstOrNull { s.startsWith(it) }?.let { s = s.removePrefix(it) }
    s = s.replace(article, "")
    if (s.startsWith("ال")) s = s.substring(2)
    return s.filter { it.isLetterOrDigit() }
  }

  /** "Sheikh Mishary Al-Afasy" -> [mishary, afasy]. */
  fun tokens(text: String): List<String> =
    fold(text).split(Regex("[^\\p{L}\\p{N}]+"))
      .map { if (it.length > 4 && it.startsWith("al")) it.substring(2) else it }
      .filter { it.isNotEmpty() && it !in honorifics }

  /** "Yaseen" and "Ya-Sin" -> "yasin"; "Baqara" and "Al-Baqarah" -> "baqara". */
  fun phonetic(normalized: String): String {
    var s = normalized
    listOf("ee" to "i", "ii" to "i", "oo" to "u", "ou" to "u", "uu" to "u", "aa" to "a").forEach { (from, to) ->
      s = s.replace(from, to)
    }
    val collapsed = StringBuilder()
    s.forEach { if (collapsed.isEmpty() || collapsed.last() != it) collapsed.append(it) }
    if (collapsed.length > 3 && collapsed.endsWith("h")) collapsed.setLength(collapsed.length - 1)
    return collapsed.toString()
  }

  fun distance(a: String, b: String): Int {
    if (a.isEmpty()) return b.length
    if (b.isEmpty()) return a.length
    var previous = IntArray(b.length + 1) { it }
    for (i in 1..a.length) {
      val current = IntArray(b.length + 1)
      current[0] = i
      for (j in 1..b.length) {
        current[j] = minOf(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
      }
      previous = current
    }
    return previous[b.length]
  }

  /** Close enough for speech: one edit for short names, two for longer ones. */
  fun isNear(a: String, b: String): Boolean {
    if (minOf(a.length, b.length) < 4) return false
    return distance(a, b) <= if (maxOf(a.length, b.length) >= 8) 2 else 1
  }

  fun surahScore(query: String, surah: CarSurah): Int {
    val q = normalize(query)
    if (q.isEmpty()) return 0
    if (q == surah.id.toString()) return 100
    val names = listOf(normalize(surah.name), normalize(surah.nameArabic))
    if (q in names) return 100
    val translation = normalize(surah.translation)
    if (q == translation) return 95
    if (names.any { phonetic(it) == phonetic(q) }) return 90
    if (names.any { isNear(it, q) }) return 85
    if (q.length >= 4 && names.any { it.startsWith(q) || it.contains(q) }) return 75
    if (isNear(translation, q)) return 70
    return 0
  }

  fun reciterScore(query: String, reciter: CarReciter): Int {
    val q = normalize(query)
    val name = normalize(reciter.name)
    if (q.isEmpty()) return 0
    if (q == name) return 100
    val queryTokens = tokens(query)
    val nameTokens = tokens(reciter.name)
    if (queryTokens.isEmpty()) return 0
    val allFound = queryTokens.all { qt -> nameTokens.any { it == qt || isNear(it, qt) } }
    if (allFound) return if (queryTokens.size > 1) 90 else 80
    if (q.length >= 4 && name.contains(q)) return 75
    val someFound = queryTokens.any { qt -> qt.length >= 4 && nameTokens.any { it == qt || isNear(it, qt) } }
    return if (someFound) 60 else 0
  }

  fun listScore(query: String, list: CarList): Int {
    var q = normalize(query)
    if (q.length > 4 && q.startsWith("my")) q = q.substring(2)
    val title = normalize(list.title)
    if (q.isEmpty()) return 0
    if (q == title) return 100
    if (listAliases[list.id]?.contains(q) == true) return 95
    if (isNear(title, q)) return 85
    if (q.length >= 5 && title.startsWith(q)) return 70
    return 0
  }

  /** "kahf by mishary" -> ("kahf", "mishary"). */
  fun splitReciter(text: String): Pair<String, String?> {
    val lower = text.lowercase()
    for (separator in reciterSeparators) {
      val at = lower.indexOf(separator)
      if (at > 0 && text.substring(0, at).isNotBlank()) {
        return text.substring(0, at) to text.substring(at + separator.length)
      }
    }
    return text to null
  }

  private fun bestReciter(query: String, s: CarSnapshot): CarReciter? =
    s.reciters
      .map { it to reciterScore(query, it) }
      .filter { it.second >= 60 }
      // Ties go to favourites, then the snapshot (catalogue) order.
      .maxWithOrNull(compareBy<Pair<CarReciter, Int>> { it.second }.thenBy { if (it.first.isFavorite) 1 else 0 })
      ?.first

  private fun rewayah(reciter: CarReciter, surahId: Int): CarRewayah? =
    reciter.rewayat.filter { surahId in it.surahIds }.maxByOrNull { it.surahIds.size }

  private fun surahMatch(surah: CarSurah, preferred: CarReciter?, s: CarSnapshot): CarVoiceMatch? {
    val candidates = listOfNotNull(preferred, s.reciters.firstOrNull { it.id == s.topReciterId }) +
      s.reciters.filter { it.isFavorite } + s.reciters
    for (reciter in candidates) {
      val w = rewayah(reciter, surah.id) ?: continue
      return CarVoiceMatch(CarBrowseTree.surahRequest(reciter.id, w.id, surah.id), surah.name, reciter.name, CarArtwork.Surah(surah.id))
    }
    return null
  }

  private fun listMatch(list: CarList, shuffle: Boolean): CarVoiceMatch? {
    val first = list.items.firstOrNull()?.action as? CarItemAction.Play ?: return null
    val request = JSONObject(first.requestJson).put("startIndex", 0)
    if (shuffle && request.optString("kind") == "loved") request.put("shuffle", true)
    val artwork = list.items.firstOrNull()?.artwork ?: CarArtwork.Color("", "#333333")
    return CarVoiceMatch(request.toString(), list.title, null, artwork)
  }

  private fun jumpBackIn(s: CarSnapshot): List<CarItem> =
    s.sections.firstOrNull { it.id == "jump-back-in" }?.items.orEmpty()

  /** A reciter alone: their latest Jump back in entry, else their first surah. */
  private fun reciterMatch(reciter: CarReciter, s: CarSnapshot): CarVoiceMatch? {
    jumpBackIn(s).firstOrNull { it.subtitle == reciter.name && it.action is CarItemAction.Play }?.let { item ->
      return CarVoiceMatch((item.action as CarItemAction.Play).requestJson, item.title, reciter.name, item.artwork)
    }
    val w = reciter.rewayat.maxByOrNull { it.surahIds.size } ?: return null
    val surahId = w.surahIds.minOrNull() ?: return null
    val surah = s.surahs.firstOrNull { it.id == surahId } ?: return null
    return surahMatch(surah, reciter, s)
  }

  private fun resumeMatch(s: CarSnapshot): CarVoiceMatch? {
    val first = jumpBackIn(s).firstOrNull() ?: return null
    return CarVoiceMatch(RESUME_REQUEST, first.title, first.subtitle, first.artwork)
  }

  fun search(query: String): List<CarVoiceMatch> = search(CarBridge.snapshot, query)

  /** Best match first; empty when nothing in the snapshot fits. A blank query resumes. */
  fun search(s: CarSnapshot?, query: String, shuffle: Boolean = false): List<CarVoiceMatch> {
    if (s == null) return emptyList()
    val (head, tail) = splitReciter(query.trim())
    val name = head.trim()
    val artist = tail?.trim()?.takeIf { it.isNotEmpty() }
    val reciter = artist?.let { bestReciter(it, s) }
    if (artist != null && reciter == null) return emptyList()

    if (name.isEmpty()) {
      reciter?.let { r -> reciterMatch(r, s)?.let { return listOf(it) } }
      return listOfNotNull(resumeMatch(s))
    }

    val lists = s.lists.values.map { it to listScore(name, it) }.filter { it.second >= 70 }.sortedByDescending { it.second }
    val surahs = s.surahs.map { it to surahScore(name, it) }.filter { it.second >= 70 }.sortedByDescending { it.second }
    val preferLists = (lists.firstOrNull()?.second ?: 0) > (surahs.firstOrNull()?.second ?: 0)
    val listResults = lists.mapNotNull { listMatch(it.first, shuffle) }
    val surahResults = surahs.take(3).flatMap { (surah, _) ->
      // With no reciter named, offer the top reciter first, then favourites that have it.
      if (reciter != null) {
        listOfNotNull(surahMatch(surah, reciter, s))
      } else {
        val first = surahMatch(surah, null, s)
        val others = s.reciters.filter { it.isFavorite }
          .mapNotNull { r -> rewayah(r, surah.id)?.let { w -> CarVoiceMatch(CarBrowseTree.surahRequest(r.id, w.id, surah.id), surah.name, r.name, CarArtwork.Surah(surah.id)) } }
        (listOfNotNull(first) + others).distinctBy { it.request }
      }
    }
    val results = (if (preferLists) listResults + surahResults else surahResults + listResults).toMutableList()

    // "Play Sudais": the name was a reciter, not a surah or playlist.
    if (results.isEmpty() && artist == null) {
      bestReciter(name, s)?.let { r -> reciterMatch(r, s)?.let(results::add) }
    }
    return results.take(MAX_RESULTS)
  }

  const val RESUME_REQUEST = "{\"kind\":\"resume\"}"
}
