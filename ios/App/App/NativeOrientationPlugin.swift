import Capacitor
import UIKit

@objc(NativeOrientationPlugin)
class NativeOrientationPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeOrientationPlugin"
    let jsName = "NativeOrientation"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lockPortrait", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lockLandscape", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterFullscreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exitFullscreen", returnType: CAPPluginReturnPromise)
    ]

    @objc func lockPortrait(_ call: CAPPluginCall) {
        setOrientation(.portrait, value: UIInterfaceOrientation.portrait.rawValue)
        call.resolve()
    }

    @objc func lockLandscape(_ call: CAPPluginCall) {
        setOrientation(.landscape, value: UIInterfaceOrientation.landscapeRight.rawValue)
        call.resolve()
    }

    @objc func unlock(_ call: CAPPluginCall) {
        setOrientation(.allButUpsideDown, value: UIInterfaceOrientation.unknown.rawValue)
        call.resolve()
    }

    @objc func enterFullscreen(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }

    @objc func exitFullscreen(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }

    private func setOrientation(_ mask: UIInterfaceOrientationMask, value: Int) {
        AppDelegate.orientationLock = mask
        DispatchQueue.main.async { [weak self] in
            UIDevice.current.setValue(value, forKey: "orientation")
            self?.bridge?.viewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
            UIViewController.attemptRotationToDeviceOrientation()
        }
    }
}
