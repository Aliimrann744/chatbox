# Agora.io Setup Guide

This app uses [Agora.io](https://www.agora.io/) for real-time audio and video calling.

## 1. Create an Agora Account

1. Go to https://sso.agora.io/en/signup and create a free account
2. Verify your email address

## 2. Create a Project

1. Log into https://console.agora.io/
2. Click **"Create New"** project
3. Enter a project name (e.g., "Chatbox")
4. Select **"Secured mode: APP ID + Token"**
5. Click **Create**

## 3. Get Your Credentials

1. From the project list, copy the **App ID**
2. Click the edit icon on your project
3. Copy the **Primary Certificate** (this is your App Certificate)

## 4. Configure Environment Variables

### Server (`server/.env`)

```
AGORA_APP_ID=<your_app_id>
AGORA_APP_CERTIFICATE=<your_primary_certificate>
```

### Client (`client/.env`)

```
EXPO_PUBLIC_AGORA_APP_ID=<your_app_id>
```

## 5. Free Tier

- **10,000 free minutes per month** — no credit card required
- Covers audio and video calls
- More than enough for development and small-scale production

## 6. Custom Dev Build

Since `react-native-agora` requires native modules, you need a custom dev build:

```bash
cd client
npx expo prebuild
npx expo run:android  # or npx expo run:ios
```

The app already uses `expo-dev-client`, so this integrates seamlessly.
