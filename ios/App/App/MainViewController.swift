import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(NativeVodPlugin.self)
        bridge?.registerPluginType(NativeKickPlugin.self)
        bridge?.registerPluginType(NativeOrientationPlugin.self)
    }
}
