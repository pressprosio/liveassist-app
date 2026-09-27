# LiveAssist mobile app

The iPhone and Android app for your team: answer website chats, join when a visitor asks for a person, and get notified even when your phone is locked. It connects to your LiveAssist hub (`chat.presspros.io`) with the same email and password as the web console.

Built with Expo (React Native), so one codebase makes both apps, and Expo's cloud service (EAS) builds them. **You don't need a Mac or Xcode.**

---

## Before you start

| You need | Cost | Where |
|---|---|---|
| Your hub updated to the latest version | – | See "Update the hub first" below |
| Node.js 22 or newer on your computer | Free | nodejs.org |
| Expo account | Free tier is enough | expo.dev/signup |
| Apple Developer Program | $99/year | developer.apple.com/programs (approval can take 1–2 days) |
| Google Play Console | $25 one-time | play.google.com/console (only needed to publish via Play; not for direct installs) |
| Firebase project | Free | console.firebase.google.com (delivers Android notifications) |

### Update the hub first

The app needs the hub version that includes password changes and phone notifications. Upload the updated hub files to your `liveassist-hub` GitHub repo, then in the Lightsail SSH window run:

```
cd ~/liveassist-hub
git pull && docker compose up -d --build
```

The database update runs automatically on start.

---

## 1. Put the code on GitHub and your computer

Create a **private** GitHub repository named `liveassist-app` and upload this folder's contents. Then on your computer:

```
git clone https://github.com/<you>/liveassist-app.git
cd liveassist-app
npm install
```

## 2. Connect it to your Expo account

```
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` creates the project on expo.dev and adds its project ID to `app.json`. Commit that change:

```
git add app.json && git commit -m "Link EAS project" && git push
```

## 3. Choose your app IDs (optional)

`app.json` uses `io.presspros.liveassist` as both the iOS bundle identifier and the Android package name. They must be unique worldwide and can't be changed after you publish, so change them now if you prefer something else. Use the same value in Firebase (next step).

## 4. Set up Android notifications (Firebase)

1. In the **Firebase console**, create a project (Google Analytics isn't needed).
2. Click **Add app → Android**. Enter the package name `io.presspros.liveassist` and register the app.
3. Download **google-services.json** and put it in the root of this project, next to `app.json`. Commit it: it's required for Android builds.
4. In Firebase, go to **Project settings → Service accounts** and click **Generate new private key**. Keep that JSON file private and **don't** commit it.
5. Give that key to Expo so it can send notifications on your behalf:
   ```
   npx eas-cli@latest credentials
   ```
   Choose **Android** → **production** → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → upload the file from step 4.

   Expo's guide, if the menu wording differs: https://docs.expo.dev/push-notifications/fcm-credentials/

iPhone notifications need no Firebase. EAS sets up Apple's push key during the first iOS build (step 6).

## 5. Build for Android

```
npx eas-cli@latest build --profile preview --platform android
```

When it finishes (about 10–20 minutes), EAS shows a link and QR code. Open it on each Android phone to download and install the app. Allow installs from your browser if Android asks.

## 6. Build for iPhone

For a team app, **TestFlight** is the easiest way to install on iPhones:

```
npx eas-cli@latest build --profile production --platform ios
```

EAS asks you to sign in with your Apple Developer account. **Answer yes** to generating certificates and to **setting up push notifications**. Then send the build to TestFlight:

```
npx eas-cli@latest submit --platform ios --latest
```

In **App Store Connect → TestFlight**, add your team members as testers. They install Apple's TestFlight app and accept the invite. The first TestFlight review usually takes under a day. The app doesn't have to be listed publicly in the App Store.

## 7. Sign in and test notifications

1. Open the app. The hub address is already filled in. Sign in with your email and password.
2. Allow notifications when asked.
3. Go to **Settings → Send a test notification**, then lock your phone. The test notification should appear within a few seconds.
4. On presspros.io, open the chat and type "can I talk to a person?". Your phone gets a **"a visitor wants a person"** notification. Tap it to open the chat, then tap **Join chat**.

---

## Team members and passwords

- **Add someone** (in the Lightsail SSH window):
  ```
  docker compose exec hub npm run agent:create -- --email sam@presspros.io --name "Sam"
  ```
  It prints a **temporary password**. At first sign-in, in the app or the web console, they're required to choose their own.
- **Change your password** anytime: in the app, go to **Settings → Change password**. In the web console, click **Change password** in the top bar. This signs out your other devices.
- **Forgotten password:** an admin runs `agent:reset-password` on the hub, which issues a new temporary password.
- **Remove someone:** `agent:remove` immediately stops their access and their notifications.

## What notifies you

- **A visitor asks for a person:** everyone signed in on a phone is notified.
- **A visitor replies in a chat you've joined:** only you are notified, and only while you're not in the app.

The app icon badge shows how many visitors are waiting for a person (iPhone).

## Updating the app later

After changing the code, build again with the same commands in steps 5 and 6. `autoIncrement` in `eas.json` bumps the build number for you. Android phones install the new APK from the link, and TestFlight updates iPhones automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the hub" at sign-in | Check the hub address and that `https://chat.presspros.io/health` loads on the phone. |
| "Email or password is incorrect" | Passwords are case-sensitive. After 10 failed attempts, wait 15 minutes. |
| Settings says notifications are off | Turn them on in the phone's settings for LiveAssist, then reopen the app. |
| "This build has no EAS project ID" | Run `npx eas-cli@latest init`, commit `app.json`, and rebuild. |
| Android build fails mentioning `google-services.json` | Add the file from Firebase step 3 to the project root. |
| Test notification never arrives on Android | Re-upload the FCM V1 service-account key (step 4.5) and check the package name matches Firebase exactly. |
| Test notification never arrives on iPhone | Rebuild iOS and say yes to push notifications, or run `npx eas-cli@latest credentials` → iOS → Push Notifications. |

## Project layout

```
src/app/                screens (Expo Router: every file is a screen)
  _layout.tsx           sign-in gate, notification taps, navigation
  login.tsx             sign in
  password.tsx          change password (required after a temporary one)
  inbox.tsx             chat list
  conversation/[id].tsx transcript, join/hand back/end, reply, suggest a reply
  settings.tsx          account, notifications, sign out
src/lib/                session state, hub connection, API, push, storage
src/components/         buttons, fields, badges, message formatting
```

Sign-in tokens are stored in the iPhone Keychain or Android Keystore, never in plain files.
