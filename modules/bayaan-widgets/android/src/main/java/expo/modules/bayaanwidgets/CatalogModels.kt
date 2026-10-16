package expo.modules.bayaanwidgets

import org.json.JSONObject

data class CatalogReciter(val id: String, val name: String, val artworkFile: String)
data class CatalogDhikr(val id: String, val arabic: String, val translation: String?, val repeatCount: Int)

data class WidgetCatalog(val reciters: List<CatalogReciter>, val adhkar: List<CatalogDhikr>) {
  fun reciter(id: String?): CatalogReciter? = id?.let { wanted -> reciters.firstOrNull { it.id == wanted } }
  fun dhikr(id: String): CatalogDhikr? = adhkar.firstOrNull { it.id == id }
}

/** Decodes catalog.json (modules/bayaan-widgets/src/catalog.ts). */
object CatalogModels {
  const val VERSION = 1

  fun decode(json: String): WidgetCatalog? = try {
    val o = JSONObject(json)
    if (o.getInt("version") != VERSION) null else {
      val r = o.getJSONArray("reciters")
      val a = o.getJSONArray("adhkar")
      WidgetCatalog(
        (0 until r.length()).map { i ->
          r.getJSONObject(i).let { CatalogReciter(it.getString("id"), it.getString("name"), it.getString("artworkFile")) }
        },
        (0 until a.length()).map { i ->
          a.getJSONObject(i).let {
            CatalogDhikr(
              it.getString("id"), it.getString("arabic"),
              if (it.isNull("translation")) null else it.getString("translation"), it.getInt("repeatCount"),
            )
          }
        },
      )
    }
  } catch (e: Exception) { null }
}
