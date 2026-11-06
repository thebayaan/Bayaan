package expo.modules.bayaanrestart

import android.content.Context
import com.facebook.react.modules.i18nmanager.I18nUtil
import com.jakewharton.processphoenix.ProcessPhoenix
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Restarts the app in a new process so a language change applies at once.
 *
 * Not an in-process JS reload (reloadAppAsync, Updates.reloadAsync): on React
 * Native 0.86 the old runtime can render after its scheduler is torn down and
 * crash. A new process starts React Native from scratch.
 */
class BayaanRestartModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BayaanRestart")

    Function("restart") { rtl: Boolean ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      persistLayoutDirection(context, rtl)
      ProcessPhoenix.triggerRebirth(context)
    }
  }

  /**
   * React Native reads the layout direction when it starts. I18nUtil saves it
   * with apply(), which may not reach disk before this process exits; a
   * commit() on the same preferences blocks until those writes are on disk.
   */
  private fun persistLayoutDirection(context: Context, rtl: Boolean) {
    val i18n = I18nUtil.instance
    i18n.allowRTL(context, rtl)
    i18n.forceRTL(context, rtl)
    i18n.swapLeftAndRightInRTL(context, true)
    context.getSharedPreferences(I18N_PREFS, Context.MODE_PRIVATE).edit().commit()
  }

  private companion object {
    // I18nUtil's SHARED_PREFS_NAME in React Native.
    const val I18N_PREFS = "com.facebook.react.modules.i18nmanager.I18nUtil"
  }
}
