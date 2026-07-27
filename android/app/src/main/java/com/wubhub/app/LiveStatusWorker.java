package com.wubhub.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class LiveStatusWorker extends Worker {
    private static final String CHANNEL_ID = "wubhub_live_status";
    private static final int KICK_NOTIFICATION_ID = 31001;
    private static final int TWITCH_NOTIFICATION_ID = 31002;

    public LiveStatusWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(NativeBackgroundLivePlugin.PREFS_NAME, Context.MODE_PRIVATE);

        try {
            if (prefs.getBoolean(NativeBackgroundLivePlugin.KEY_KICK_ENABLED, false)) {
                LiveDetails details = checkKick();
                handleLiveState(
                    prefs,
                    NativeBackgroundLivePlugin.KEY_KICK_INITIALIZED,
                    NativeBackgroundLivePlugin.KEY_KICK_WAS_LIVE,
                    "Kick",
                    details,
                    KICK_NOTIFICATION_ID
                );
            }

            if (prefs.getBoolean(NativeBackgroundLivePlugin.KEY_TWITCH_ENABLED, false)) {
                LiveDetails details = checkTwitch();
                handleLiveState(
                    prefs,
                    NativeBackgroundLivePlugin.KEY_TWITCH_INITIALIZED,
                    NativeBackgroundLivePlugin.KEY_TWITCH_WAS_LIVE,
                    "Twitch",
                    details,
                    TWITCH_NOTIFICATION_ID
                );
            }

            return Result.success();
        } catch (Exception error) {
            return Result.retry();
        }
    }

    private void handleLiveState(
        SharedPreferences prefs,
        String initializedKey,
        String wasLiveKey,
        String platform,
        LiveDetails details,
        int notificationId
    ) {
        boolean initialized = prefs.getBoolean(initializedKey, false);
        boolean wasLive = prefs.getBoolean(wasLiveKey, false);

        if (initialized && !wasLive && details.isLive) {
            showLiveNotification(platform, details.title, notificationId);
        }

        prefs.edit()
            .putBoolean(initializedKey, true)
            .putBoolean(wasLiveKey, details.isLive)
            .apply();
    }

    private LiveDetails checkKick() throws Exception {
        String channelJson = requestText("https://kick.com/api/v2/channels/paymoneywubby", "application/json, text/plain, */*");
        JSONObject channel = new JSONObject(channelJson);
        JSONObject livestream = channel.optJSONObject("livestream");
        boolean isLive = livestream != null;
        String title = extractFirstText(
            channel.optString("session_title", ""),
            channel.optString("title", ""),
            livestream == null ? "" : livestream.optString("session_title", ""),
            livestream == null ? "" : livestream.optString("title", "")
        );

        if (isLive && title.isEmpty()) {
            try {
                JSONObject livestreamData = new JSONObject(requestText("https://kick.com/api/v2/channels/paymoneywubby/livestream", "application/json, text/plain, */*"));
                title = extractFirstText(livestreamData.optString("session_title", ""), livestreamData.optString("title", ""));
            } catch (Exception ignored) {
                // Live state is still useful if Kick refuses the title endpoint.
            }
        }

        return new LiveDetails(isLive, title);
    }

    private LiveDetails checkTwitch() throws Exception {
        try {
            LiveDetails graphStatus = checkTwitchGraphql();
            if (graphStatus != null) {
                return graphStatus;
            }
        } catch (Exception ignored) {
            // DecAPI fallback keeps the temporary worker alive if Twitch changes GraphQL.
        }

        String uptime = requestText("https://decapi.me/twitch/uptime/paymoneywubby?offline_msg=offline", "text/plain");
        String normalized = uptime.toLowerCase(Locale.US);
        boolean isLive = !normalized.trim().equals("offline")
            && !normalized.contains("offline")
            && !normalized.contains("not live")
            && !normalized.contains("does not exist");
        String title = "";

        if (isLive) {
            try {
                title = requestText("https://decapi.me/twitch/title/paymoneywubby", "text/plain").trim();
            } catch (Exception ignored) {
                // Notification can still be sent without title subtext.
            }
        }

        return new LiveDetails(isLive, title);
    }

    private LiveDetails checkTwitchGraphql() throws Exception {
        String body = "{"
            + "\"operationName\":\"WubHubChannelLiveStatus\","
            + "\"variables\":{\"login\":\"paymoneywubby\"},"
            + "\"query\":\"query WubHubChannelLiveStatus($login: String!) { user(login: $login) { id login stream { id title type createdAt } } }\""
            + "}";
        String responseBody = requestText(
            "https://gql.twitch.tv/gql",
            "application/json",
            "POST",
            body,
            "kimne78kx3ncx6brgo4mv6wki5h1ko"
        );
        JSONObject responseJson = new JSONObject(responseBody);
        JSONObject data = responseJson.optJSONObject("data");
        JSONObject user = data == null ? null : data.optJSONObject("user");

        if (user == null) {
            return null;
        }

        JSONObject stream = user.optJSONObject("stream");
        if (stream == null) {
            return new LiveDetails(false, "");
        }

        return new LiveDetails(true, stream.optString("title", "").trim());
    }

    private String requestText(String url, String acceptHeader) throws Exception {
        return requestText(url, acceptHeader, "GET", null, null);
    }

    private String requestText(String url, String acceptHeader, String method, String requestBody, String twitchClientId) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(12000);
        connection.setRequestProperty("Accept", acceptHeader);
        connection.setRequestProperty("User-Agent", "WubHub Android");
        connection.setRequestProperty("X-Requested-With", "XMLHttpRequest");

        if (twitchClientId != null) {
            connection.setRequestProperty("Client-ID", twitchClientId);
        }

        if (requestBody != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.getOutputStream().write(requestBody.getBytes(StandardCharsets.UTF_8));
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String body = readStream(stream);
        connection.disconnect();

        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Request failed: " + status);
        }

        return body;
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }

        return builder.toString();
    }

    private String extractFirstText(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }

        return "";
    }

    private void showLiveNotification(String platform, String streamTitle, int notificationId) {
        Context context = getApplicationContext();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        createNotificationChannel(context);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String body = streamTitle == null || streamTitle.trim().isEmpty() ? "Live now on WubHub." : streamTitle.trim();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.wubhub.app.R.mipmap.ic_launcher)
            .setContentTitle("Wubby is now live on " + platform)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Live stream alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Alerts when Wubby goes live on Kick or Twitch.");
        manager.createNotificationChannel(channel);
    }

    private static class LiveDetails {
        final boolean isLive;
        final String title;

        LiveDetails(boolean isLive, String title) {
            this.isLive = isLive;
            this.title = title;
        }
    }
}
