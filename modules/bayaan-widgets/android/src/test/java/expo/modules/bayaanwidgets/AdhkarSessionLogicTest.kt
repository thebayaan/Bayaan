package expo.modules.bayaanwidgets

import java.io.File
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class AdhkarSessionLogicTest {
  private val v = JSONObject(File("../src/__fixtures__/adhkarSession.vectors.json").readText())
  private val rc = v.getJSONArray("repeatCounts").let { a -> List(a.length()) { a.getInt(it) } }
  private val ids = v.getJSONArray("ids").let { a -> List(a.length()) { a.getString(it) } }

  private fun session(o: Any?): AdhkarSession? = (o as? JSONObject)?.let {
    AdhkarSession(it.getString("period"), it.getString("day"), it.getInt("index"), it.getInt("remaining"),
      it.getBoolean("completed"), if (it.isNull("startedAtMs")) null else it.getLong("startedAtMs"))
  }

  private fun each(key: String, f: (JSONObject) -> Unit) {
    val a: JSONArray = v.getJSONArray(key)
    for (i in 0 until a.length()) f(a.getJSONObject(i))
  }

  @Test fun sessionDay() {
    val a = v.getJSONArray("sessionDay")
    for (i in 0 until a.length()) {
      val p = a.getJSONArray(i)
      assertEquals(p.getString(1), AdhkarSessionLogic.sessionDay(p.getLong(0), TimeZone.getTimeZone("UTC")))
    }
  }

  @Test fun resolve() = each("resolve") { c ->
    assertEquals(c.getString("name"), session(c.getJSONObject("expect")),
      AdhkarSessionLogic.resolve(session(c.opt("stored")), c.getString("period"), c.getString("day"), rc))
  }

  @Test fun apply() = each("apply") { c ->
    val action = AdhkarSessionAction.valueOf(c.getString("action").uppercase())
    assertEquals(c.getString("name"), session(c.getJSONObject("expect")),
      AdhkarSessionLogic.apply(action, session(c.getJSONObject("start"))!!, rc, c.getLong("nowMs")))
  }

  @Test fun completionEvent() = each("completion") { c ->
    val start = session(c.getJSONObject("start"))!!
    val nowMs = c.getLong("nowMs")
    val after = AdhkarSessionLogic.apply(AdhkarSessionAction.valueOf(c.getString("action").uppercase()), start, rc, nowMs)
    val want = c.optJSONObject("expect")?.let {
      AdhkarSessionCompletion(it.getString("category"), it.getLong("duration_ms"), it.getInt("dhikr_count"), it.getLong("completedAtMs"))
    }
    assertEquals(c.getString("name"), want, AdhkarSessionLogic.completionEvent(start, after, rc, "morning-adhkar", nowMs))
  }

  @Test fun link() = each("link") { c ->
    assertEquals(c.getString("expect"), AdhkarSessionLogic.link("morning-adhkar", session(c.getJSONObject("session"))!!, ids))
  }

  @Test fun encodeRoundTrips() {
    val s = AdhkarSession("evening", "2026-10-12", 3, 2, false, 99L)
    assertEquals(s, AdhkarSessionLogic.decode(AdhkarSessionLogic.encode(s)))
    assertEquals(null, AdhkarSessionLogic.decode("nope"))
  }
}
