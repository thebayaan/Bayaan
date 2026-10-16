import ExpoModulesCore

public class BayaanCarModule: Module {
  private let ownerId = UUID()

  public func definition() -> ModuleDefinition {
    Name("BayaanCar")
    Events("onPlayRequest", "onTransport", "onCarConnectionChanged")

    OnCreate {
      CarBridge.shared.attach(owner: ownerId) { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnDestroy {
      CarBridge.shared.detach(owner: ownerId)
    }

    Function("writeSnapshot") { (json: String) in
      CarBridge.shared.writeSnapshot(json: json)
    }

    Function("setNowPlaying") { (json: String?) in
      CarBridge.shared.setNowPlaying(json: json)
    }

    Function("markJsReady") {
      CarBridge.shared.markJsReady()
    }
  }
}
