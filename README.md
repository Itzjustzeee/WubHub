# WubHub

<p align="center">
<img width="200" height="200" alt="WubHub2-transparent" src="https://github.com/user-attachments/assets/0f970fcc-1842-469b-aba7-00158a4ea0a9" />
</p>

WubHub is a community stream hub for PaymoneyWubby viewers, built with React, Vite, and Capacitor for web, Android mobile, Android TV, and iOS targets.

## Preview

### Desktop

<p align="center">
  <img src="docs/preview-desktop-home.png" alt="WubHub desktop homepage preview" width="420" />
  <img src="docs/preview-desktop-stream.png" alt="WubHub desktop stream page preview" width="420" />
</p>

### Mobile

<p align="center">
  <img src="docs/preview-mobile.jpg" alt="WubHub mobile homepage preview" width="240" />
  <img src="docs/preview-mobile-twitch.png" alt="WubHub mobile Twitch stream preview" width="240" />
  <img src="docs/preview-mobile-links.png" alt="WubHub mobile links drawer preview" width="240" />
</p>

## What It Does

- Watch Kick and Twitch streams from one app.
- Open stream pages with fullscreen support and embedded chat.
- View live status for Kick and Twitch.
- Receive optional live notifications for each platform.
- Browse Wubby YouTube channels and latest-video carousel cards.
- Open Parasocial VODs, official merch, The Green Room, Discord, Subreddit, and Twitter/X links.
- Use a TV-focused layout with remote-control focus states.
- Use a mobile layout with bottom navigation and live indicators.

## Platforms

- Web preview through Vite
- Android mobile through Capacitor
- Android TV through Capacitor
- iOS through Capacitor

## Requirements

- Node.js
- npm
- Android Studio / Android SDK for Android builds
- Xcode for iOS builds

## Install

```sh
npm install
```

## Run Locally

```sh
npm run dev
```

The Vite dev server runs with host access enabled so it can be tested from local devices on the network.

## Build Web Assets

```sh
npm run build
```

## Sync Capacitor

```sh
npx cap sync
```

For Android only:

```sh
npx cap sync android
```

For iOS only:

```sh
npx cap sync ios
```

## Build Android Debug APK

From the project root:

```sh
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is generated under:

```text
android/app/build/outputs/apk/debug/
```

## Notes

WubHub is an unofficial community app. Platform embeds, chat login behavior, and autoplay behavior can depend on Kick, Twitch, YouTube, Android WebView, and iOS WebKit policies.
