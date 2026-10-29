package expo.modules.bayaanwidgets

/** Small text helpers, mirrored by WidgetLogic.swift. */
object WidgetText {
  fun initials(name: String): String =
    name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }

  fun reference(surahName: String, key: String): String = "$surahName $key"

  // @ai-start
  /**
   * Drops leading words until the name fits maxChars, so "Mishary Alafasi"
   * becomes "Alafasi" instead of "Mishary Alaf…". Glance cannot measure text,
   * so callers pass a character budget for the space they have.
   */
  fun fitName(name: String, maxChars: Int): String {
    var words = name.split(' ').filter { it.isNotBlank() }
    while (words.size > 1 && words.joinToString(" ").length > maxChars) words = words.drop(1)
    return words.joinToString(" ").ifEmpty { name }
  }

  /** "Morning Adhkar" to "Morning" when it does not fit: the icon already says which. */
  fun fitTitle(title: String, maxChars: Int): String =
    if (title.length <= maxChars) title else title.substringBefore(' ')

  /** "Al-Baqarah" to "Baqarah" when it does not fit: drops the leading article. */
  fun shortSurahName(name: String, maxChars: Int): String =
    if (name.length <= maxChars) name else name.replaceFirst(Regex("^[A-Za-z]{1,3}-"), "")
  // @ai-end
}
