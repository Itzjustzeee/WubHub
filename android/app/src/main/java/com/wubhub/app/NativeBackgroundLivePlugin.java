package com.wubhub.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.Constraints;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "NativeBackgroundLive")
public class NativeBackgroundLivePlugin extends Plugin {
    static final String PREFS_NAME = "wubhub_background_live";
    static final String WORK_NAME = "wubhub_live_status_poll";
    static final String KEY_KICK_ENABLED = "kick_enabled";
    static final String KEY_TWITCH_ENABLED = "twitch_enabled";
    static final String KEY_KICK_INITIALIZED = "kick_initialized";
    static final String KEY_TWITCH_INITIALIZED = "twitch_initialized";
    static final String KEY_KICK_WAS_LIVE = "kick_was_live";
    static final String KEY_TWITCH_WAS_LIVE = "twitch_was_live";

    @PluginMethod
    public void configure(PluginCall call) {
        boolean kickEnabled = call.getBoolean("kick", false);
        boolean twitchEnabled = call.getBoolean("twitch", false);
        Context context = getContext().getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        prefs.edit()
            .putBoolean(KEY_KICK_ENABLED, kickEnabled)
            .putBoolean(KEY_TWITCH_ENABLED, twitchEnabled)
            .apply();

        if (kickEnabled || twitchEnabled) {
            scheduleLivePolling(context);
        } else {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
        }

        JSObject result = new JSObject();
        result.put("scheduled", kickEnabled || twitchEnabled);
        call.resolve(result);
    }

    @PluginMethod
    public void resetBaseline(PluginCall call) {
        getContext()
            .getApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_KICK_INITIALIZED)
            .remove(KEY_TWITCH_INITIALIZED)
            .remove(KEY_KICK_WAS_LIVE)
            .remove(KEY_TWITCH_WAS_LIVE)
            .apply();
        call.resolve();
    }

    static void scheduleLivePolling(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
            LiveStatusWorker.class,
            PeriodicWorkRequest.MIN_PERIODIC_INTERVAL_MILLIS,
            TimeUnit.MILLISECONDS
        )
            .setConstraints(constraints)
            .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        );
    }
}
