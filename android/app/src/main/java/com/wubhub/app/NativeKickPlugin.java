package com.wubhub.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeKick")
public class NativeKickPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "https://kick.com/paymoneywubby");
        Intent intent = new Intent(getActivity(), KickWebViewActivity.class);
        intent.putExtra(KickWebViewActivity.EXTRA_URL, url);
        getActivity().startActivity(intent);
        call.resolve();
    }
}
