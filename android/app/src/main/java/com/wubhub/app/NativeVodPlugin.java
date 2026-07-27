package com.wubhub.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeVod")
public class NativeVodPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "https://parasoci.al/vods");
        Intent intent = new Intent(getActivity(), VodWebViewActivity.class);
        intent.putExtra(VodWebViewActivity.EXTRA_URL, url);
        startActivityForResult(call, intent, "handleVodResult");
    }

    @ActivityCallback
    private void handleVodResult(PluginCall call, ActivityResult result) {
        JSObject data = new JSObject();
        String target = "vods";

        if (result.getData() != null) {
            target = result.getData().getStringExtra(VodWebViewActivity.EXTRA_TARGET);
            if (target == null) {
                target = "vods";
            }
        }

        data.put("target", target);
        call.resolve(data);
    }
}
