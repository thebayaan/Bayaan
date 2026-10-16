package expo.modules.bayaanwidgets

/** Small text helpers, mirrored by WidgetLogic.swift. */
object WidgetText {
  fun initials(name: String): String =
    name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }

  fun reference(surahName: String, key: String): String = "$surahName $key"
}
