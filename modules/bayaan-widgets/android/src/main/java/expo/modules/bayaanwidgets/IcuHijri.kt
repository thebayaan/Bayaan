// main/java/expo/modules/bayaanwidgets/IcuHijri.kt
package expo.modules.bayaanwidgets

import android.icu.util.IslamicCalendar
import android.icu.util.ULocale
import android.icu.util.TimeZone as IcuTimeZone

/**
 * Umm al-Qura through android.icu (API 24, minSdk 24). The JVM unit tests use
 * java.time's HijrahDate against the same table; the device check in the plan's
 * last task compares this on a real Android runtime.
 */
object IcuHijri : HijriOf {
  override fun at(dayNumber: Long): HijriDate? = runCatching {
    val cal = IslamicCalendar(IcuTimeZone.getTimeZone("UTC"), ULocale.ENGLISH)
    cal.setCalculationType(IslamicCalendar.CalculationType.ISLAMIC_UMALQURA)
    cal.timeInMillis = dayNumber * 86_400_000L + 43_200_000L
    HijriDate(cal.get(IslamicCalendar.YEAR), cal.get(IslamicCalendar.MONTH) + 1, cal.get(IslamicCalendar.DAY_OF_MONTH))
  }.getOrNull()
}
