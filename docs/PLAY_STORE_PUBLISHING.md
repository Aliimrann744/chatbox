# Whatchat — Play Store Publishing Guide

End-to-end runbook for getting the first Play Store release out, and for shipping
every update after it without logging users out or breaking updates.

---

## 0. One-time setup

### 0.1 Google Play developer account
1. Create/sign in at https://play.google.com/console (US$25 one-time fee).
2. Complete identity verification (D-U-N-S number for Organizations, or personal ID
   for Individuals). Google now requires this before you can publish.
3. Create a new app:
   - App name: **Whatchat**
   - Default language: **English (United States)**
   - App or game: **App**
   - Free or paid: **Free**
   - Accept the policies checkboxes.

### 0.2 Expo / EAS account
1. `npm install -g eas-cli`
2. `eas login` (use the Expo account that owns project `7ed6cda6-e617-4ac3-843e-9d99f5041d7f`)
3. From `client/`: `eas whoami` should print your username.

### 0.3 Keystore (signing)
You already have `@aliimrann744__Chatbox.jks` locally — don't lose this file.
Either:

- **Option A (recommended)**: let EAS own the keystore. First time you run
  `eas build --platform android --profile production` EAS will ask "Generate a new
  Android Keystore?" — answer **Yes**. It stores the keystore in your Expo account
  and every future build signs with the same key. All subsequent Play Store updates
  are valid because the signing key is stable.

- **Option B**: upload your existing `.jks`:
  ```
  eas credentials --platform android
  ```
  Pick `production` profile → Keystore → Upload your own → provide `.jks`, keystore
  password, key alias, key password.

> ⚠ Once the first build is on Play, **you can never change the signing key**
> without uninstall/reinstall (Play App Signing mitigates this but the upload key
> still needs to be consistent). Back up the keystore from Expo via
> `eas credentials --platform android` → `Download Keystore`.

---

## 1. Answers to your specific questions

### Q. Is the app suitable for Play Store?
Yes after the fixes applied in this changeset:
- App name changed from `WhatsApp` → `Whatchat` (trademark violation would have been rejected).
- Facebook plugin `displayName` and iOS `scheme` also renamed.
- Production EAS profile now builds an **AAB** (Play Store's required format), not APK.
- `expo-build-properties` pins `targetSdkVersion: 35` (Android 15) — Google's current minimum for new apps.
- `expo-updates` wired for OTA JS/asset updates.
- Session storage keys hardcoded — env drift no longer logs users out on update.

### Q. How do I build an AAB?

```bash
cd client
eas build --platform android --profile production
```

This produces `.aab` on EAS servers, signs it with your keystore, and prints a
download URL. Auto-increments `versionCode` in your Expo project metadata because
`eas.json` has `"autoIncrement": true` + `"appVersionSource": "remote"`.

### Q. How is updating handled — do users have to uninstall?
**No.** On Android, installing an update over an existing app preserves all app
data (SecureStore, MMKV cache, files) as long as two things are true:
1. `applicationId` stays the same (currently `com.whatchat.com`).
2. The APK/AAB is signed with the same key (EAS handles this).

The Play Store does this automatically for every user once you roll out a new
release. No user action needed.

### Q. Will login sessions survive an update?
Yes, now that it's fixed. Tokens are stored in `expo-secure-store` (backed by
Android Keystore). The storage keys were previously env-driven — **fixed in this
changeset** to `whatchat.auth.accessToken` / `whatchat.auth.refreshToken`. Keys
are stable across builds, so tokens are readable after update. Session only
clears on:
- Explicit logout.
- Server rejecting the refresh token with 401/403 (user will see login screen).
- User uninstalling the app (OS wipes all app data).

### Q. How do I notify users of updates and auto-update?
Two-tier strategy — both already wired in `client/hooks/use-app-updates.ts`:

1. **EAS Update (JS + assets OTA)** — every time the user opens Whatchat the app
   calls `Updates.checkForUpdateAsync()`, downloads a new JS bundle if there is
   one, and applies it silently on next cold start. No Play Store round-trip.
   Ship a JS update with:
   ```bash
   eas update --branch production --message "bug fixes"
   ```
   Users on current native binary get it on next app open. WhatsApp-style.

2. **Native update (new AAB)** — needed when you add a new library, permission,
   or touch anything that requires a rebuild. After `eas build + submit`, Play
   Store handles rollout automatically. To *force* laggy users to update
   (WhatsApp's "please update" screen):
   - Add an endpoint on your backend that returns `{ "minVersion": "1.0.3" }`.
   - On app launch, fetch it and call `promptNativeUpdate()` from
     `hooks/use-app-updates.ts`. That opens the Play Store listing.
   - For the true native Play in-app-update dialog (no leaving your app), install:
     ```bash
     npx expo install sp-react-native-in-app-updates
     ```
     and call `inAppUpdates.checkNeedsUpdate()` + `startUpdate()`. Requires a new
     native build (it ships a native module).

### Q. Is the Android package name set?
Yes: `com.whatchat.com` in `app.config.ts`. Same value in `google-services.json`,
`ios.bundleIdentifier`, and (will be) in your Play Console listing. **Do not change it**
after the first release — Play treats it as a different app.

### Q. Is versionCode handled?
Yes. `eas.json` has `"appVersionSource": "remote"` + `"autoIncrement": true` on
the production profile. Every `eas build` increments the Android versionCode
automatically in EAS's server-side metadata. Play Console will never see a
duplicate.

### Q. Target SDK / API level?
`expo-build-properties` pins `targetSdkVersion: 35` (Android 15) and
`compileSdkVersion: 35`, which is Google Play's requirement for new apps
submitted after August 31, 2025.

### Q. Does EAS handle Play Store publishing?
Yes — once configured. The flow is:
1. `eas build --platform android --profile production` → produces `.aab`.
2. `eas submit --platform android --profile production` → uploads `.aab` to Play.

For step 2 you need a **Google Play service account JSON**. Generate it once
(see §3) and save as `client/play-service-account.json`. It's already referenced
in `eas.json`. Add this filename to `.gitignore` — it's a secret.

You still use **Play Console** for:
- Store listing (description, screenshots, icons).
- Data Safety answers.
- Age rating questionnaire.
- Rollout percentage and track management.

---

## 2. Store listing content

Copy/paste into Play Console → Grow users → Store presence → Main store listing.

### App name (30 chars max)
```
Whatchat
```

### Short description (80 chars max)
```
Simple, secure chat & calls. Private messaging, voice & video, in one app.
```

### Full description (4000 chars max)
```
Whatchat is a fast, private messaging app built for people who care about
clean design and real privacy. Send text, photos, videos, voice notes, and
files to anyone, anywhere, with zero friction.

FEATURES

Messaging
• One-to-one chats with read receipts and typing indicators
• Groups up to 256 members with role-based permissions
• Reply, forward, edit, star, and delete for everyone
• Voice notes, photos, videos, documents, contacts, and live location
• Wallpapers and per-chat notification settings

Calls
• Crystal-clear voice and video calls
• Group voice/video calls with automatic quality adjustment
• Full-screen incoming call UI with lock-screen controls

Privacy & security
• End-to-end secured authentication flows
• Two-factor authentication (TOTP apps + email) with backup codes
• Privacy controls for Last Seen, Profile Photo, and About
• Block, report, and mute any contact or group
• Device login history and new-device alerts

Status updates
• 24-hour status posts with photos and videos
• See who viewed your status with per-viewer privacy

Convenience
• Works over cellular or Wi-Fi — low data mode included
• Back up your messages, restore on a new device
• Multiple languages out of the box
• Clean dark mode that actually looks good

No ads. No clutter. Just chat.
```

### Category
```
Communication
```

### Tags (choose up to 5 in Play Console)
- Messaging
- Video calls
- Voice calls
- Chat
- Privacy

### Contact details
- Website: `https://whatsappbizz.online` (replace with your product site)
- Email: `support@whatsappbizz.online` (use an address you monitor)
- Phone: optional

### Privacy policy URL
Required. Host `docs/PRIVACY_POLICY.md` (draft included) at a public URL such as
`https://whatsappbizz.online/privacy` and paste the URL.

---

## 3. Graphics checklist

Files already generated in this changeset — upload from the paths below.

| Asset | Play Console field | Path | Dimensions |
|---|---|---|---|
| App icon (inside AAB) | auto-embedded | `client/assets/images/icon.png` | 1024×1024 |
| Android adaptive foreground | auto-embedded | `client/assets/images/adaptive-icon-fg.png` | 1024×1024 |
| Store icon (high-res) | Main store listing → Icon | `client/assets/store/play-icon-512.png` | 512×512 |
| Feature graphic | Main store listing → Feature graphic | `client/assets/store/play-feature-graphic.png` | 1024×500 |
| Phone screenshots | Main store listing → Phone screenshots | `client/assets/images/*.jpeg` (use any 2+ chat-screen/call-page/group-chat) | min 1080×1920 |

> You need **at least 2 phone screenshots** and the feature graphic. 8 screenshots
> is the sweet spot for conversion. Use the existing `chat-screen.jpeg`,
> `chat-detail-page.jpeg`, `group-chat.jpeg`, `video-call-page.jpeg`,
> `settings-page1.jpeg` as starters — they're already sized for 1170×2532ish.

---

## 4. Data Safety answers

Play Console → App content → Data safety. Answer:

### Overall
- Does your app collect or share any of the required user data types?
  **Yes**
- Is all of the user data collected encrypted in transit? **Yes** (HTTPS/TLS everywhere)
- Do you provide a way for users to request their data be deleted?
  **Yes** (Settings → Account → Delete account + Request my data)

### Data types collected
Check these boxes:

**Personal info**
- Name — Collected, Not shared — Required — Why: Account, App functionality
- Email address — Collected, Not shared — Required — Why: Account, Communications
- Phone number — Collected, Not shared — Required — Why: Account (OTP login)
- User IDs — Collected, Not shared — Required — Why: Account

**Photos & videos**
- Photos — Collected, Not shared — Optional — Why: App functionality (sending media)
- Videos — Collected, Not shared — Optional — Why: App functionality

**Audio files**
- Voice or sound recordings — Collected, Not shared — Optional — Why: App functionality (voice notes & calls)

**Files & docs**
- Files and docs — Collected, Not shared — Optional — Why: App functionality (file sharing)

**Messages**
- In-app messages — Collected, Not shared — Required — Why: App functionality

**Contacts**
- Contacts — Collected, Not shared — Optional — Why: App functionality (contact discovery)

**App info and performance**
- Crash logs — Collected, Not shared — Optional — Why: Analytics
- Diagnostics — Collected, Not shared — Optional — Why: Analytics

**Device or other IDs**
- Device or other IDs — Collected, Not shared — Required — Why: Analytics, Fraud prevention (FCM token)

### Data security practices
- Data is encrypted in transit: **Yes**
- You can request that data be deleted: **Yes**
- Follows Google Play Families Policy: **N/A** (app is 13+)
- Independent security review: **No** (unless you've had one)

---

## 5. App content questionnaire

Play Console → App content:

| Section | Answer |
|---|---|
| Privacy policy | paste URL |
| App access | "All functionality available without restrictions" (login required but free) |
| Ads | "No, my app does not contain ads" |
| Content rating | Answer the IARC questionnaire truthfully — chat apps typically get **Teen** or **Everyone 10+**. Key answers: No violence, No sex, No gambling, User-generated content = Yes (chat) |
| Target audience | 13+ (age range), do not target children |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | see §4 above |
| Government app | No |

---

## 6. Build, sign, submit — the actual commands

### 6.1 First build (generates keystore if you don't have one)

```bash
cd client

# Install CLI if you haven't
npm install -g eas-cli

# Login
eas login

# One-time: link project (already linked — you'll see projectId in output)
eas init

# Build signed AAB for Play Store
eas build --platform android --profile production
```

EAS prints a URL. Wait 15–25 minutes. Download the `.aab` from that URL.

### 6.2 Set up Play service account (one time, for `eas submit`)

1. Go to https://play.google.com/console → Settings (left sidebar) → API access.
2. "Choose a project to link" → "Create a new Google Cloud project" (or pick one).
3. "Service accounts" → "Create new service account" → Google Cloud Console opens.
4. Name it `play-publisher`, no role on the Cloud side — finish.
5. Back in Play Console → grant the service account **Admin (all permissions)** for this app only.
6. In Google Cloud Console → the service account → Keys → Add Key → JSON → download.
7. Save as `client/play-service-account.json`.
8. Add to `.gitignore`:
   ```
   play-service-account.json
   ```

### 6.3 Submit

```bash
eas submit --platform android --profile production --latest
```

`--latest` uses the most recent production build. By default this goes to the
**Internal testing** track (safe — lets you QA with a testers list first).

### 6.4 Promote to production

Inside Play Console → Production → Create new release → "Copy from Internal testing".
Roll out at 5–10% first, monitor crashes in Play Console → Quality → Crashes, then
bump to 100%.

### 6.5 Shipping a JS-only update (no Play review)

```bash
cd client
eas update --branch production --message "Describe the change"
```

Every phone on that same `runtimeVersion` (currently tied to app version `1.0.0`)
downloads the new bundle on next open.

### 6.6 Shipping a new native version (bumps versionCode)

```bash
cd client

# Bump the version in app.config.ts (e.g., 1.0.0 → 1.0.1).
# runtimeVersion.policy is 'appVersion' so the new build gets its own OTA lane.

eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

Play Console handles rollout to all existing users. No uninstall needed, sessions
stay intact.

---

## 7. Play Console step-by-step (first release)

1. **Create app** (done in 0.1).
2. **Dashboard → Set up your app** — you'll see a checklist. Complete top to bottom:
   - App access → Full access
   - Ads → No ads
   - Content rating → start questionnaire
   - Target audience → 13+
   - News app → No
   - Data safety → fill from §4
   - Government app → No
   - Financial features → No
   - Health → No
   - Privacy policy → paste URL
3. **Main store listing**:
   - App name: `Whatchat`
   - Short description: (§2)
   - Full description: (§2)
   - App icon: upload `play-icon-512.png`
   - Feature graphic: upload `play-feature-graphic.png`
   - Phone screenshots: upload 2–8 PNG/JPEG from `assets/images/`
   - Category: Communication
   - Tags: pick up to 5
   - Contact details: email + website
4. **Production → Countries/regions → Add countries** (start with a handful if
   you want, or Worldwide).
5. **Internal testing**:
   - Testers → Create email list → add your own email plus any beta testers.
   - Releases → Create new release → upload your `.aab` (produced in 6.1).
   - Release name: `1.0.0 (build 1)`
   - Release notes: short changelog. First release: `Initial release of Whatchat.`
   - Save → Review release → Start rollout. Internal testers can install within
     minutes via the opt-in link.
6. **QA on a real device** using the opt-in link. Check: login works, push
   notifications arrive (FCM OTP), calls connect, session persists after you kill
   and relaunch the app.
7. **Promote to Production**:
   - Production → Create release → Release from library (pick the same AAB from
     internal testing, or copy).
   - Enter release notes.
   - Start rollout → 10%.
8. Wait for Google Play review. First review typically 3–7 days, subsequent
   reviews are faster. You'll get an email when the app goes live.

---

## 8. After launch — keeping users logged in and happy

### What survives a Play Store update
- ✅ SecureStore tokens (auth/refresh JWTs)
- ✅ MMKV cache (chats, contacts, calls)
- ✅ User-generated files in app storage
- ✅ Notification permissions, FCM token
- ✅ App preferences (language, theme)

### What wipes data
- ❌ User uninstalls the app
- ❌ "Clear data" button in Android system settings
- ❌ App signing key changes (**never do this**)
- ❌ applicationId changes (**never do this**)
- ❌ A storage migration on our side that deletes keys (we don't have one)

### Telemetry
Monitor in Play Console → Quality:
- Android vitals — ANRs, crashes, excessive wakeups.
- Pre-launch reports — Google runs your build on real devices.

---

## 9. Emergency hotfix playbook

1. **Bug in JS only** (most bugs): `eas update --branch production --message "fix"`.
   Propagates in minutes. No Play review.
2. **Bug in native code**: bump version → `eas build` → `eas submit` → staged
   rollout to 20% → monitor 24h → bump to 100%. Total turnaround 1–3 days.
3. **Bug so severe you need to halt**: Play Console → Production → "Halt rollout".
   Then ship a fix.

---

## 10. File changes in this setup

- `client/app.config.ts` — renamed to Whatchat, scheme, expo-updates, build-properties, new icon paths.
- `client/eas.json` — production → AAB, added channels, added submit config.
- `client/constants/constant.ts` — hardcoded stable SecureStore keys.
- `client/hooks/use-app-updates.ts` — OTA check on launch + foreground, optional native-update prompt.
- `client/app/_layout.tsx` — wires `useAppUpdates()`.
- `client/assets/images/logo/*.svg` — Whatchat brand assets (source of truth).
- `client/assets/images/icon.png`, `adaptive-icon-fg.png`, `splash-icon.png`, `favicon.png` — rasterized icons.
- `client/assets/store/play-icon-512.png`, `play-feature-graphic.png` — store assets.
- `client/scripts/generate-icons.js` — regenerates all PNGs from SVG.
- `docs/PRIVACY_POLICY.md` — draft privacy policy (host publicly).
