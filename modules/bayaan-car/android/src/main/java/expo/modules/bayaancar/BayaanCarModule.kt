package expo.modules.bayaancar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanCarModule : Module() {
  private val ownerToken = Any()

  override fun definition() = ModuleDefinition {
    Name("BayaanCar")
    Events("onPlayRequest", "onTransport", "onCarConnectionChanged")

    OnCreate {
      appContext.reactContext?.applicationContext?.let { CarBridge.init(it) }
      CarBridge.registerEmitter(ownerToken) { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      CarBridge.unregisterEmitter(ownerToken)
    }

    Function("writeSnapshot") { json: String -> CarBridge.writeSnapshot(json) }
    Function("setNowPlaying") { json: String? -> CarBridge.setNowPlaying(json) }
    Function("markJsReady") {
      CarBridge.markJsReady()
    }
  }
}
