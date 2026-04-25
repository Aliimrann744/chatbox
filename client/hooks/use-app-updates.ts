import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Two-tier update strategy for Play Store releases.
 *
 * 1. EAS Update (expo-updates) — fetches new JS / asset bundles OTA on launch
 *    and when the app returns to foreground. Used for fixes that don't touch
 *    native code. Bundle is applied next launch (or immediately via reload).
 *
 * 2. Native Play Store update — when a new native binary is published the
 *    JS bundle cannot patch it; the user has to install a fresh APK/AAB from
 *    Play. We detect that by asking the backend for a "min supported version"
 *    and prompting the user to update if their `expo-constants.nativeAppVersion`
 *    is older. For a true in-app update dialog (like WhatsApp's) install
 *    `sp-react-native-in-app-updates` and swap the prompt below for
 *    `inAppUpdates.checkNeedsUpdate()` + `startUpdate()`.
 */
export function useAppUpdates() {
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (__DEV__) return; // expo-updates only runs in standalone release builds

    checkForOtaUpdate();
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  const onAppStateChange = (state: AppStateStatus) => {
    if (state !== 'active') return;
    // Debounce: only re-check once per foreground-cycle.
    if (checkedOnce.current) {
      checkedOnce.current = false;
      return;
    }
    checkForOtaUpdate();
  };

  const checkForOtaUpdate = async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      await Updates.fetchUpdateAsync();
      // Silent apply: next cold start uses the new bundle.
      // If you want WhatsApp-style "restart now" UX uncomment the Alert:
      //
      // Alert.alert(
      //   'Update ready',
      //   'A new version of Whatchat has been downloaded. Restart to apply?',
      //   [
      //     { text: 'Later', style: 'cancel' },
      //     { text: 'Restart', onPress: () => Updates.reloadAsync() },
      //   ],
      // );
      checkedOnce.current = true;
    } catch {
      // Network errors are ignored — we'll try again on next foreground.
    }
  };
}

/**
 * Hard-gate users on very old native versions. Call this once on app launch
 * after you've fetched the server-side minimum supported version.
 *
 * The Play Store open URL works even if the app was sideloaded, so it's a
 * safe fallback when sp-react-native-in-app-updates isn't installed.
 */
export function promptNativeUpdate(opts: {
  currentVersion: string;
  minSupportedVersion: string;
  storeUrl?: string;
}) {
  if (isVersionGte(opts.currentVersion, opts.minSupportedVersion)) return;

  const fallbackUrl =
    Platform.OS === 'android'
      ? opts.storeUrl || 'market://details?id=com.whatchat.com'
      : opts.storeUrl || 'itms-apps://itunes.apple.com/app/id0000000000';

  Alert.alert(
    'Update required',
    'A newer version of Whatchat is required to continue. Please update from the Play Store.',
    [
      {
        text: 'Update',
        onPress: () => Linking.openURL(fallbackUrl).catch(() => {}),
      },
    ],
    { cancelable: false },
  );
}

function isVersionGte(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}
