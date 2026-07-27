package com.wubhub.app;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePlatform")
public class NativePlatformPlugin extends Plugin {
    @PluginMethod
    public void getInfo(PluginCall call) {
        Context context = getContext();
        UiModeManager uiModeManager = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
        PackageManager packageManager = context.getPackageManager();
        boolean uiModeTelevision = uiModeManager != null
            && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        boolean hasLeanback = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK);
        boolean hasTelevision = packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
        boolean hasTouchscreen = packageManager.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
        boolean isTelevision = uiModeTelevision || hasLeanback || hasTelevision || !hasTouchscreen;

        DisplayMetrics metrics = new DisplayMetrics();
        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (windowManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                getActivity().getDisplay().getRealMetrics(metrics);
            } else {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
            }
        }

        JSObject result = new JSObject();
        result.put("isTelevision", isTelevision);
        result.put("uiModeTelevision", uiModeTelevision);
        result.put("hasLeanback", hasLeanback);
        result.put("hasTelevision", hasTelevision);
        result.put("hasTouchscreen", hasTouchscreen);
        result.put("widthPixels", metrics.widthPixels);
        result.put("heightPixels", metrics.heightPixels);
        result.put("density", metrics.density);
        call.resolve(result);
    }
}
